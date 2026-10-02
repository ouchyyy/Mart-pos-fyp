// ============================================================
// CategoriesPopup.jsx — add, rename and remove product groups
// ============================================================

import { useState } from 'react';
import { addCategory, renameCategory, deleteCategory } from '../database';

export default function CategoriesPopup({ categories, onClose, onChanged }) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [error, setError] = useState('');

  async function handleAdd() {
    if (newName.trim() === '') {
      return;
    }

    setError('');

    try {
      await addCategory(newName.trim());
      setNewName('');
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRename(id) {
    setError('');

    try {
      await renameCategory(id, editingName.trim());
      setEditingId(null);
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(category) {
    const sure = window.confirm('Remove the category "' + category.name + '"?');

    if (!sure) {
      return;
    }

    setError('');

    try {
      await deleteCategory(category.id);
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="popup" onClick={(e) => e.stopPropagation()}>
        <h2>Categories</h2>

        {error && <div className="error">{error}</div>}

        <div className="box" style={{ padding: 0, marginBottom: 16 }}>
          <table>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id}>
                  <td>
                    {editingId === category.id ? (
                      <input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        autoFocus
                      />
                    ) : (
                      category.name
                    )}
                  </td>
                  <td className="right" style={{ whiteSpace: 'nowrap' }}>
                    {editingId === category.id ? (
                      <>
                        <button className="small" onClick={() => setEditingId(null)}>
                          Cancel
                        </button>{' '}
                        <button
                          className="small primary"
                          onClick={() => handleRename(category.id)}
                        >
                          Save
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="small"
                          onClick={() => {
                            setEditingId(category.id);
                            setEditingName(category.name);
                          }}
                        >
                          Rename
                        </button>{' '}
                        <button
                          className="small danger"
                          onClick={() => handleDelete(category)}
                        >
                          Remove
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {categories.length === 0 && (
            <div className="empty small-text">No categories yet.</div>
          )}
        </div>

        <label>
          <span>New category</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="Drinks, Snacks, Household..."
            />
            <button className="primary" onClick={handleAdd}>
              Add
            </button>
          </div>
        </label>

        <div className="popup-buttons">
          <button className="primary" onClick={onClose} style={{ flex: 1 }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
