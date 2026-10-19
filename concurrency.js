// Call inside the same write transaction as the mutation. A stock revision is
// separate so that sales never invalidate an unrelated content edit.
export function assertRevision(expected, current) {
  if (!Number.isSafeInteger(expected) || expected < 0) {
    throw Object.assign(new Error('Cần phiên bản dữ liệu đã đọc. Hãy tải lại trước khi lưu.'), { status: 428, httpStatus: 428 });
  }
  if (expected !== current) {
    throw Object.assign(new Error('Dữ liệu đã được thay đổi. Hãy đối chiếu dữ liệu mới trước khi lưu lại.'), { status: 409, httpStatus: 409 });
  }
}

export function csvRevision(value) {
  return typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
}
