const pool = require('../config/db');

function toDomain(row) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    quantity: row.quantity == null ? null : Number(row.quantity),
    unit: row.unit,
    note: row.note,
    checked: row.checked,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getAllForUser(userId) {
  const { rows } = await pool.query(
    `SELECT * FROM dayly.grocery_items WHERE user_id = $1
     ORDER BY checked ASC, created_at ASC`,
    [userId]
  );
  return rows.map(toDomain);
}

async function create(userId, item) {
  const { rows } = await pool.query(
    `INSERT INTO dayly.grocery_items (user_id, name, quantity, unit, note, checked)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      userId,
      item.name,
      item.quantity ?? null,
      item.unit ?? null,
      item.note ?? null,
      item.checked ?? false,
    ]
  );
  return toDomain(rows[0]);
}

// Partial update, same pattern as preferences.repository.js — a client
// toggling `checked` shouldn't have to resend name/quantity/unit/note.
async function update(userId, id, patch) {
  const fields = [];
  const values = [];
  let i = 1;

  for (const [key, column] of [
    ['name', 'name'],
    ['quantity', 'quantity'],
    ['unit', 'unit'],
    ['note', 'note'],
    ['checked', 'checked'],
  ]) {
    if (key in patch) {
      fields.push(`${column} = $${i++}`);
      values.push(patch[key]);
    }
  }
  if (fields.length === 0) {
    const { rows } = await pool.query(
      'SELECT * FROM dayly.grocery_items WHERE user_id = $1 AND id = $2',
      [userId, id]
    );
    return rows[0] ? toDomain(rows[0]) : null;
  }

  fields.push('updated_at = now()');
  values.push(userId, id);

  const { rows } = await pool.query(
    `UPDATE dayly.grocery_items SET ${fields.join(', ')}
     WHERE user_id = $${i++} AND id = $${i}
     RETURNING *`,
    values
  );
  return rows[0] ? toDomain(rows[0]) : null;
}

async function remove(userId, id) {
  const { rows } = await pool.query(
    'DELETE FROM dayly.grocery_items WHERE user_id = $1 AND id = $2 RETURNING id',
    [userId, id]
  );
  return rows.length > 0;
}

// Bulk-clear everything already checked off — the "clear purchased
// items" action a grocery list needs once the list gets long.
async function clearChecked(userId) {
  const { rows } = await pool.query(
    'DELETE FROM dayly.grocery_items WHERE user_id = $1 AND checked = true RETURNING id',
    [userId]
  );
  return rows.length;
}

module.exports = { getAllForUser, create, update, remove, clearChecked };
