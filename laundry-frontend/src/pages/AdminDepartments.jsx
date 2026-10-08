import { useEffect, useState } from "react";
import AdminLayout from "../components/AdminLayout";
import {
  listDepartments,
  createDepartment,
  renameDepartment,
  deleteDepartment,
  getDepartmentItems,
  addDepartmentItem,
  updateDepartmentItem,
  removeDepartmentItem,
} from "../api/api";

const emptyItemForm = { itemName: "", weightPerPc: "" };

export default function AdminDepartments() {
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState(null);
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [error, setError] = useState("");

  // New department
  const [newDeptName, setNewDeptName] = useState("");
  const [addingDept, setAddingDept] = useState(false);

  // Rename department
  const [renamingDept, setRenamingDept] = useState(null); // name currently being renamed
  const [renameValue, setRenameValue] = useState("");

  // Item add/edit form
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [editingItemId, setEditingItemId] = useState(null); // null = adding new
  const [savingItem, setSavingItem] = useState(false);
  const [itemFormError, setItemFormError] = useState("");

  const loadDepartments = async () => {
    try {
      const { data } = await listDepartments();
      setDepartments(Array.isArray(data) ? data : []);
    } catch {
      setError("Failed to load departments.");
      setDepartments([]);
    }
  };

  const loadItems = async (deptName) => {
    setLoadingItems(true);
    try {
      const { data } = await getDepartmentItems(deptName);
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoadingItems(false);
    }
  };

  useEffect(() => {
    loadDepartments();
  }, []);

  const selectDept = (name) => {
    setSelectedDept(name);
    setItemForm(emptyItemForm);
    setEditingItemId(null);
    setItemFormError("");
    loadItems(name);
  };

  const handleAddDepartment = async () => {
    if (!newDeptName.trim()) return;
    setAddingDept(true);
    setError("");
    try {
      await createDepartment(newDeptName.trim());
      setNewDeptName("");
      await loadDepartments();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add department.");
    } finally {
      setAddingDept(false);
    }
  };

  const startRename = (name, e) => {
    e.stopPropagation();
    setRenamingDept(name);
    setRenameValue(name);
  };

  const cancelRename = (e) => {
    e?.stopPropagation();
    setRenamingDept(null);
    setRenameValue("");
  };

  const saveRename = async (oldName, e) => {
    e.stopPropagation();
    if (!renameValue.trim() || renameValue.trim() === oldName) {
      cancelRename();
      return;
    }
    try {
      await renameDepartment(oldName, renameValue.trim());
      if (selectedDept === oldName) setSelectedDept(renameValue.trim());
      setRenamingDept(null);
      loadDepartments();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to rename department.");
    }
  };

  const handleDeleteDepartment = async (name, e) => {
    e.stopPropagation(); // don't trigger selectDept when clicking delete
    if (
      !confirm(
        `Delete "${name}" entirely? This removes all its items from the dropdown. Employees still assigned to this department won't be able to submit until reassigned. This cannot be undone.`
      )
    ) {
      return;
    }
    try {
      await deleteDepartment(name);
      if (selectedDept === name) {
        setSelectedDept(null);
        setItems([]);
      }
      loadDepartments();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete department.");
    }
  };

  const openAddItem = () => {
    setEditingItemId(null);
    setItemForm(emptyItemForm);
    setItemFormError("");
  };

  const openEditItem = (item) => {
    setEditingItemId(item._id);
    setItemForm({ itemName: item.itemName, weightPerPc: String(item.weightPerPc) });
    setItemFormError("");
  };

  const handleSaveItem = async () => {
    const weight = Number(itemForm.weightPerPc);
    if (!itemForm.itemName.trim() || !weight || weight <= 0) {
      setItemFormError("Item name and a valid weight (kg) are required.");
      return;
    }
    setSavingItem(true);
    setItemFormError("");
    try {
      const payload = { itemName: itemForm.itemName.trim(), weightPerPc: weight };
      if (editingItemId) {
        await updateDepartmentItem(selectedDept, editingItemId, payload);
      } else {
        await addDepartmentItem(selectedDept, payload);
      }
      setItemForm(emptyItemForm);
      setEditingItemId(null);
      loadItems(selectedDept);
    } catch (err) {
      setItemFormError(err.response?.data?.message || "Failed to save item.");
    } finally {
      setSavingItem(false);
    }
  };

  const handleRemoveItem = async (item) => {
    if (!confirm(`Remove "${item.itemName}" from ${selectedDept}'s dropdown?`)) return;
    await removeDepartmentItem(selectedDept, item._id);
    loadItems(selectedDept);
  };

  return (
    <AdminLayout title="Departments & Items">
      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3 mb-4">{error}</div>}

      <div className="flex flex-col md:flex-row gap-4">
        {/* Department list */}
        <div className="bg-white rounded-xl shadow p-4 md:w-64 shrink-0">
          <h2 className="text-sm font-medium text-gray-500 mb-2">Departments</h2>
          <div className="space-y-1 mb-3">
            {(departments || []).length === 0 && (
              <p className="text-sm text-gray-400">No departments yet.</p>
            )}
            {(departments || []).map((d) =>
              renamingDept === d ? (
                <div key={d} className="flex items-center gap-1 px-2 py-1.5">
                  <input
                    type="text"
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.key === "Enter" && saveRename(d, e)}
                    className="flex-1 min-w-0 border border-blue-300 rounded-lg px-2 py-1.5 text-sm"
                  />
                  <button onClick={(e) => saveRename(d, e)} className="text-green-600 text-xs px-1 shrink-0">✓</button>
                  <button onClick={cancelRename} className="text-gray-400 text-xs px-1 shrink-0">✕</button>
                </div>
              ) : (
                <div
                  key={d}
                  onClick={() => selectDept(d)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-pointer ${
                    selectedDept === d ? "bg-blue-50 text-blue-600 font-medium" : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span className="truncate">{d}</span>
                  <span className="flex gap-1 shrink-0">
                    <button
                      onClick={(e) => startRename(d, e)}
                      className="text-gray-400 hover:text-blue-600 text-xs px-1"
                      title={`Rename ${d}`}
                    >
                      ✎
                    </button>
                    <button
                      onClick={(e) => handleDeleteDepartment(d, e)}
                      className="text-red-400 hover:text-red-600 text-xs px-1"
                      title={`Delete ${d}`}
                    >
                      ✕
                    </button>
                  </span>
                </div>
              )
            )}
          </div>
          <div className="flex gap-2 pt-2 border-t border-gray-100">
            <input
              type="text"
              placeholder="New department"
              value={newDeptName}
              onChange={(e) => setNewDeptName(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-2 py-2 text-sm min-w-0"
            />
            <button
              onClick={handleAddDepartment}
              disabled={addingDept}
              className="bg-blue-600 text-white rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap disabled:bg-gray-300"
            >
              Add
            </button>
          </div>
        </div>

        {/* Items panel */}
        <div className="bg-white rounded-xl shadow p-4 flex-1">
          {!selectedDept ? (
            <p className="text-sm text-gray-400">Select a department to manage its items.</p>
          ) : (
            <>
              <h2 className="text-sm font-medium text-gray-500 mb-3">
                Items for <span className="text-gray-800 font-semibold">{selectedDept}</span>
              </h2>

              {/* Item add/edit form */}
              {itemFormError && (
                <div className="bg-red-50 text-red-700 text-sm rounded-lg p-2 mb-3">{itemFormError}</div>
              )}
              <div className="flex flex-col sm:flex-row gap-2 mb-4">
                <input
                  type="text"
                  placeholder="Item name"
                  value={itemForm.itemName}
                  onChange={(e) => setItemForm({ ...itemForm, itemName: e.target.value })}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Weight per pc (kg)"
                  value={itemForm.weightPerPc}
                  onChange={(e) => setItemForm({ ...itemForm, weightPerPc: e.target.value })}
                  className="sm:w-40 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
                <button
                  onClick={handleSaveItem}
                  disabled={savingItem}
                  className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap disabled:bg-gray-300"
                >
                  {editingItemId ? "Update Item" : "Add Item"}
                </button>
                {editingItemId && (
                  <button
                    onClick={openAddItem}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    Cancel
                  </button>
                )}
              </div>

              {/* Items table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-gray-200 text-gray-500">
                      <th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2">Weight/pc (kg)</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingItems ? (
                      <tr><td colSpan="3" className="px-3 py-4 text-center text-gray-400">Loading...</td></tr>
                    ) : (items || []).length === 0 ? (
                      <tr><td colSpan="3" className="px-3 py-4 text-center text-gray-400">No items yet.</td></tr>
                    ) : (
                      (items || []).map((item) => (
                        <tr key={item._id} className="border-b border-gray-100 last:border-0">
                          <td className="px-3 py-2">{item.itemName}</td>
                          <td className="px-3 py-2">{item.weightPerPc}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">
                            <button onClick={() => openEditItem(item)} className="text-blue-600 mr-3">Edit</button>
                            <button onClick={() => handleRemoveItem(item)} className="text-red-500">Remove</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}