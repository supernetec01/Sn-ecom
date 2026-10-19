-- Run only in a disposable database loaded with 001_initial.sql.
-- Every test fixture is rolled back. This tests storage rules, not API authorization.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path = supernet, pg_catalog;
CREATE FUNCTION pg_temp.assert_true(ok boolean, message text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', message; END IF;
  RAISE NOTICE 'PASS: %', message;
END;
$$;
CREATE FUNCTION pg_temp.expect_error(command text, expected_state text, message text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE actual_state text;
BEGIN
  BEGIN
    EXECUTE command;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS actual_state = RETURNED_SQLSTATE;
  END;
  PERFORM pg_temp.assert_true(actual_state = expected_state, message || ' [SQLSTATE ' || coalesce(actual_state,'no error') || ']');
END;
$$;
INSERT INTO accounts(id,email,display_name,password_hash) VALUES (100,'schema-test@example.test','Test','not-a-login-credential');
INSERT INTO customers(id,account_id,name) VALUES (100,100,'Test');
INSERT INTO categories(id,name,slug) VALUES (100,'Test','test');
INSERT INTO products(id,category_id,name,slug) VALUES (100,100,'Test','test');
INSERT INTO product_variants(id,product_id,sku,price_vnd) VALUES (100,100,'TEST-100',100000);
INSERT INTO warehouses(id,code,name) VALUES (100,'TEST','Test');
INSERT INTO inventory_balances(warehouse_id,variant_id,on_hand) VALUES (100,100,2);

SELECT pg_temp.expect_error($q$INSERT INTO accounts(email,display_name,password_hash) VALUES ('SCHEMA-TEST@example.test','X','x')$q$,'23514','Email must be normalized');
SELECT pg_temp.expect_error($q$INSERT INTO accounts(email,display_name,password_hash) VALUES ('schema-test@example.test','X','x')$q$,'23505','Duplicate email rejected');
SELECT pg_temp.expect_error($q$INSERT INTO product_variants(product_id,sku,price_vnd) VALUES (999999,'NO-PARENT',1)$q$,'23503','Orphan SKU rejected');
SELECT pg_temp.expect_error($q$INSERT INTO product_variants(product_id,sku,price_vnd) VALUES (100,'test-100',1)$q$,'23505','SKU unique irrespective of case');
SELECT pg_temp.expect_error($q$UPDATE inventory_balances SET on_hand=-1 WHERE warehouse_id=100$q$,'23514','Negative inventory rejected');
SELECT pg_temp.expect_error($q$UPDATE inventory_balances SET reserved=3 WHERE warehouse_id=100$q$,'23514','Reservations cannot exceed physical stock');
WITH held AS (UPDATE inventory_balances SET reserved=reserved+2 WHERE warehouse_id=100 AND variant_id=100 AND available>=2 RETURNING *)
SELECT pg_temp.assert_true((SELECT count(*) FROM held)=1,'Conditional stock reservation succeeds');
WITH held AS (UPDATE inventory_balances SET reserved=reserved+1 WHERE warehouse_id=100 AND variant_id=100 AND available>=1 RETURNING *)
SELECT pg_temp.assert_true((SELECT count(*) FROM held)=0,'Exhausted stock cannot be reserved twice');

INSERT INTO orders(id,customer_id,payment_method,subtotal_vnd,shipping_vnd,total_vnd,recipient,email,phone,province_code,province_name,ward_code,ward_name,address_line,address_version)
VALUES (100,100,'cod',200000,30000,230000,'Test','schema-test@example.test','0901234567','01','Test','00001','Test','Test street','test');
INSERT INTO order_items(id,order_id,variant_id,sku_snapshot,name_snapshot,unit_price_vnd,quantity)
VALUES (100,100,100,'TEST-100','Test',100000,2);
SET CONSTRAINTS ALL IMMEDIATE;
SELECT pg_temp.assert_true((SELECT sum(line_total_vnd)=200000 FROM order_items WHERE order_id=100),'Order subtotal equals normalized line snapshots');
SELECT pg_temp.expect_error($q$UPDATE order_items SET unit_price_vnd=1 WHERE id=100$q$,'23514','Order line snapshots are immutable');
SELECT pg_temp.expect_error($q$UPDATE orders SET subtotal_vnd=1,total_vnd=30001 WHERE id=100$q$,'23514','Placed order amounts are immutable');
SELECT pg_temp.expect_error($q$INSERT INTO orders(customer_id,payment_method,subtotal_vnd,shipping_vnd,total_vnd,recipient,email,phone,province_code,province_name,ward_code,ward_name,address_line,address_version) VALUES (100,'cod',200000,30000,1,'Test','schema-test@example.test','0901234567','01','Test','00001','Test','Test street','test')$q$,'23514','Incorrect order total rejected');
SELECT pg_temp.expect_error($q$INSERT INTO orders(customer_id,payment_method,subtotal_vnd,shipping_vnd,total_vnd,recipient,email,phone,province_code,province_name,ward_code,ward_name,address_line,address_version) VALUES (100,'cod',200000,30000,230000,'Test','schema-test@example.test','0901234567','01','Test','00001','Test','Test street','test')$q$,'23514','Order without line snapshots rejected');

INSERT INTO idempotency_keys(scope,principal,request_key,request_hash,order_id,expires_at) VALUES ('checkout','customer:100','test-request-100',repeat('a',64),100,now()+interval '1 day');
SELECT pg_temp.expect_error($q$INSERT INTO idempotency_keys(scope,principal,request_key,request_hash,expires_at) VALUES ('checkout','customer:100','test-request-100',repeat('b',64),now()+interval '1 day')$q$,'23505','Duplicate checkout key rejected');
INSERT INTO payment_transactions(id,order_id,kind,amount_vnd,provider,reference) VALUES (100,100,'receipt',230000,'manual','test-receipt');
SELECT pg_temp.expect_error($q$INSERT INTO payment_transactions(order_id,kind,amount_vnd,provider,reference) VALUES (100,'receipt',1,'manual','overpayment')$q$,'23514','Receipts cannot exceed order total');
INSERT INTO payment_events(provider,external_id,payload_hash,signature_valid,outcome) VALUES ('test','event-100',repeat('a',64),true,'accepted');
SELECT pg_temp.expect_error($q$INSERT INTO payment_events(provider,external_id,payload_hash,signature_valid,outcome) VALUES ('test','event-100',repeat('a',64),true,'accepted')$q$,'23505','Duplicate payment callback rejected');
SELECT pg_temp.expect_error($q$INSERT INTO payment_events(provider,external_id,payload_hash,signature_valid,outcome) VALUES ('test','bad-signature',repeat('a',64),false,'accepted')$q$,'23514','Unverified callback cannot be accepted');
SELECT pg_temp.expect_error($q$INSERT INTO payment_transactions(order_id,kind,amount_vnd,provider,reference) VALUES (100,'refund',230001,'manual','too-large')$q$,'23514','Refund cannot exceed receipts');
INSERT INTO payment_transactions(order_id,kind,amount_vnd,provider,reference) VALUES (100,'refund',30000,'manual','partial-refund');
SELECT pg_temp.assert_true((SELECT sum(CASE WHEN kind='receipt' THEN amount_vnd ELSE -amount_vnd END)=200000 FROM payment_transactions WHERE order_id=100),'Partial refund leaves correct net receipts');
SELECT pg_temp.expect_error($q$INSERT INTO payment_transactions(order_id,kind,amount_vnd,provider,reference) VALUES (100,'refund',30000,'manual','partial-refund')$q$,'23505','Duplicate financial reference rejected');
SELECT pg_temp.expect_error($q$DELETE FROM payment_transactions WHERE id=100$q$,'23514','Financial ledger is append-only');

SET CONSTRAINTS ALL DEFERRED;
INSERT INTO orders(id,customer_id,payment_method,subtotal_vnd,shipping_vnd,total_vnd,recipient,email,phone,province_code,province_name,ward_code,ward_name,address_line,address_version)
VALUES (101,100,'cod',100000,0,100000,'Test','schema-test@example.test','0901234567','01','Test','00001','Test','Test street','test');
INSERT INTO order_items(id,order_id,variant_id,sku_snapshot,name_snapshot,unit_price_vnd,quantity) VALUES (101,101,100,'TEST-100','Test',100000,1);
SET CONSTRAINTS ALL IMMEDIATE;
INSERT INTO shipments(id,order_id,carrier,tracking) VALUES (100,100,'test','TRACK-100');
SELECT pg_temp.expect_error($q$INSERT INTO shipment_items(shipment_id,order_item_id,order_id,quantity) VALUES (100,101,100,1)$q$,'23503','Shipment cannot reference another order line');
INSERT INTO returns(id,order_id,reason) VALUES (100,100,'Test return');
SELECT pg_temp.expect_error($q$INSERT INTO return_items(return_id,order_item_id,order_id,quantity,disposition,restocked_quantity) VALUES (100,100,100,1,'damaged',1)$q$,'23514','Damaged return cannot re-enter sellable inventory');
INSERT INTO audit_logs(id,actor_id,action,entity_type,entity_id,request_id) VALUES (100,100,'test','order','100','request-100');
SELECT pg_temp.expect_error($q$UPDATE audit_logs SET action='tampered' WHERE id=100$q$,'23514','Audit logs are append-only');
SELECT pg_temp.assert_true(NOT EXISTS(SELECT 1 FROM role_permissions WHERE role_code='sales' AND permission_code='refunds.approve'),'Sales does not receive refund approval permission');
SET CONSTRAINTS ALL IMMEDIATE;
ROLLBACK;
