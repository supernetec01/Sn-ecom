#!/usr/bin/env bash
# Creates and removes only its own isolated PostgreSQL container. No published ports.
set -euo pipefail
cd "$(dirname "$0")"
image='postgres@sha256:3645570cccdfa447589da9f57dd740faa29b30938e861289a5574b6ca6b03826'
container="sn-schema-${RANDOM}-$$"
scratch=$(mktemp -d /tmp/sn-schema-XXXXXX)
cleanup() {
  local status=$?
  if [[ "$status" != 0 ]]; then
    echo 'FAIL: PostgreSQL verification failed; isolated container and session logs follow.' >&2
    docker logs "$container" >&2 || true
    for log in "$scratch"/*; do
      if [[ -f "$log" ]]; then
        printf '\nSession log: %s\n' "${log##*/}" >&2
        cat "$log" >&2
      fi
    done
  fi
  docker rm -f "$container" >/dev/null 2>&1 || true
  rm -rf "$scratch"
  return "$status"
}
trap cleanup EXIT
docker image inspect "$image" >/dev/null 2>&1 || docker pull "$image"
docker run -d --name "$container" --network none --user postgres --entrypoint /bin/bash "$image" \
  -c 'initdb -D /tmp/sn-pg --auth-local=trust --auth-host=reject >/tmp/initdb.log && exec postgres -D /tmp/sn-pg -c listen_addresses=' >/dev/null
ready=false
for attempt in {1..30}; do
  if docker exec "$container" pg_isready -U postgres >/dev/null 2>&1; then ready=true; break; fi
  sleep 1
done
if [[ "$ready" != true ]]; then docker logs "$container"; exit 1; fi
docker exec "$container" createdb -U postgres supernet_test
psql_test() { docker exec -i "$container" psql -X -qAt -U postgres -d supernet_test -v ON_ERROR_STOP=1 "$@"; }
psql_test <001_initial.sql
psql_test <verify.sql

# Two independent sessions compete for the last unit; the conditional UPDATE must
# serialize and re-evaluate its predicate after the row lock is released.
psql_test <<'SQL'
SET search_path=supernet,pg_catalog;
INSERT INTO categories(id,name,slug) VALUES (200,'Concurrency test','concurrency');
INSERT INTO products(id,category_id,name,slug) VALUES (200,200,'Concurrency test','concurrency');
INSERT INTO product_variants(id,product_id,sku,price_vnd) VALUES (200,200,'CONCURRENCY-TEST',100000);
INSERT INTO warehouses(id,code,name) VALUES (200,'CONCURRENCY','Concurrency');
INSERT INTO inventory_balances(warehouse_id,variant_id,on_hand) VALUES (200,200,1);
BEGIN;
INSERT INTO customers(id,name) VALUES (200,'Concurrency customer');
INSERT INTO orders(id,customer_id,payment_method,subtotal_vnd,shipping_vnd,total_vnd,recipient,email,phone,province_code,province_name,ward_code,ward_name,address_line,address_version)
VALUES (200,200,'cod',100000,0,100000,'Test','test@example.test','0901234567','01','Test','00004','Test','Test','test');
INSERT INTO order_items(order_id,variant_id,sku_snapshot,name_snapshot,unit_price_vnd,quantity)
VALUES (200,200,'CONCURRENCY-TEST','Test',100000,1);
COMMIT;
SQL
reserve_one() {
  psql_test <<'SQL'
BEGIN;
UPDATE supernet.inventory_balances SET reserved=reserved+1
WHERE warehouse_id=200 AND variant_id=200 AND available>=1 RETURNING 'reserved';
SELECT pg_sleep(1);
COMMIT;
SQL
}
reserve_one >"$scratch/stock-1" & first=$!
reserve_one >"$scratch/stock-2" & second=$!
wait "$first"
wait "$second"
# Use the runner's standard tools; ripgrep is not a prerequisite for this check.
test "$(awk '$0 == "reserved" { count++ } END { print count+0 }' "$scratch/stock-1" "$scratch/stock-2")" -eq 1
test "$(psql_test -c 'SELECT reserved FROM supernet.inventory_balances WHERE warehouse_id=200 AND variant_id=200')" -eq 1
echo 'PASS: concurrent checkouts cannot reserve the same last unit'

record_payment() {
  local reference=$1
  # Explicitly acquire the order lock in a separate statement at READ COMMITTED.
  psql_test -v payment_reference="$reference" <<'SQL'
BEGIN;
SELECT id FROM supernet.orders WHERE id=200 FOR UPDATE;
INSERT INTO supernet.payment_transactions(order_id,kind,amount_vnd,provider,reference)
VALUES (200,'receipt',100000,'test',:'payment_reference');
SELECT pg_sleep(1);
COMMIT;
SQL
}
record_payment 'concurrent-1' >"$scratch/payment-1" 2>&1 & first=$!
record_payment 'concurrent-2' >"$scratch/payment-2" 2>&1 & second=$!
first_status=0; wait "$first" || first_status=$?
second_status=0; wait "$second" || second_status=$?
if [[ "$first_status" == 0 && "$second_status" != 0 ]]; then
  grep -Fq 'payment exceeds order total' "$scratch/payment-2"
elif [[ "$second_status" == 0 && "$first_status" != 0 ]]; then
  grep -Fq 'payment exceeds order total' "$scratch/payment-1"
else
  cat "$scratch/payment-1" "$scratch/payment-2"
  exit 1
fi
test "$(psql_test -c 'SELECT sum(amount_vnd) FROM supernet.payment_transactions WHERE order_id=200')" -eq 100000
echo 'PASS: concurrent receipts cannot exceed the order total'
echo 'PASS: fresh schema, storage invariants and two concurrency scenarios'
