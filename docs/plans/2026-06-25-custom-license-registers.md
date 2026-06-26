# Custom License Registers Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow superadmins to select a custom number of registers (cajas) for licenses when generating new accesses or editing existing licenses, in addition to the standard Monocaja (1) and Multicajas (999/Unlimited) options.

**Architecture:** Add a new `"personalizado"` option to the license type dropdowns in the SuperAdmin portal. When selected, show a numeric input for the number of registers. Update the creation and edit handlers to parse and save this custom count, and update the directory table to display custom counts cleanly.

**Tech Stack:** React, Supabase (PostgreSQL)

---

### Task 1: Add Custom CSS Styles for Badges

**Files:**
- Modify: `c:\POS\frontend\src\pages\SuperAdmin\SuperAdminPortal.css:487-496`

**Step 1: Write the changes**

Add `.badge`, `.badge-blue`, and `.badge-purple` classes alongside the existing `.badge-gold` class to support flexible styling of monocaja (blue), multicajas (gold), and custom (purple) license statuses.

```css
.badge {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
}

.badge-blue {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
}

.badge-purple {
  background: rgba(168, 85, 247, 0.15);
  color: #c084fc;
}
```

**Step 2: Commit**

```bash
git add frontend/src/pages/SuperAdmin/SuperAdminPortal.css
git commit -m "style: add badge styles for custom licenses in superadmin portal"
```

---

### Task 2: Add Custom License Logic & Fields to SuperAdminPortal Component

**Files:**
- Modify: `c:\POS\frontend\src\pages\SuperAdmin\SuperAdminPortal.jsx`

**Step 1: Add State Variables**

Add state variables for custom register counts for both the creation form and the edit form.

```javascript
  const [newClientMaxRegisters, setNewClientMaxRegisters] = useState(2);
  const [editLicenseMaxRegisters, setEditLicenseMaxRegisters] = useState(2);
```

**Step 2: Update `handleCreateClient`**

Modify the creation logic to check if the selected license type is `"personalizado"`. If it is, use the custom numeric input value for `max_registers`.

```javascript
      let maxRegisters = 1;
      if (newClientLicenseType === "monocaja") {
        maxRegisters = 1;
      } else if (newClientLicenseType === "multicajas") {
        maxRegisters = 999;
      } else if (newClientLicenseType === "personalizado") {
        maxRegisters = parseInt(newClientMaxRegisters) || 1;
        if (maxRegisters < 1) throw new Error("El número de cajas debe ser al menos 1");
      }
```

**Step 3: Update `handleOpenEditLicense`**

Set the edit modal state variables appropriately when a license is opened for editing, dynamically detecting custom counts.

```javascript
  const handleOpenEditLicense = (lic) => {
    setEditingLicense(lic);
    const maxRegs = lic.max_registers || 1;
    if (maxRegs === 1) {
      setEditLicenseType("monocaja");
      setEditLicenseMaxRegisters(1);
    } else if (maxRegs === 999) {
      setEditLicenseType("multicajas");
      setEditLicenseMaxRegisters(999);
    } else {
      setEditLicenseType("personalizado");
      setEditLicenseMaxRegisters(maxRegs);
    }
    setEditClientAllocatedFolios(lic.allocated_folios !== null ? String(lic.allocated_folios) : "");
    setEditLicenseError("");
    setShowEditLicenseModal(true);
  };
```

**Step 4: Update `handleUpdateLicense`**

Modify the update handler to support custom registers.

```javascript
      let maxRegisters = 1;
      if (editLicenseType === "monocaja") {
        maxRegisters = 1;
      } else if (editLicenseType === "multicajas") {
        maxRegisters = 999;
      } else if (editLicenseType === "personalizado") {
        maxRegisters = parseInt(editLicenseMaxRegisters) || 1;
        if (maxRegisters < 1) throw new Error("El número de cajas debe ser al menos 1");
      }
```

**Step 5: Update the Directory Table Render**

Render the badge based on `max_registers` to support displaying "Personalizado (X Cajas)" with the purple badge style.

```jsx
                            <span
                              className={`badge ${
                                lic.max_registers === 1
                                  ? "badge-blue"
                                  : lic.max_registers === 999
                                  ? "badge-gold"
                                  : "badge-purple"
                              }`}
                            >
                              {lic.max_registers === 1
                                ? "Monocaja (1 Caja)"
                                : lic.max_registers === 999
                                ? "Multicajas (Ilimitado)"
                                : `Personalizado (${lic.max_registers} Cajas)`}
                            </span>
```

**Step 6: Update Create Modal Form Fields**

Add the `"personalizado"` option to the select dropdown and render the numeric input when selected.

```jsx
              <div className="input-group">
                <label>Tipo de Licencia</label>
                <select
                  value={newClientLicenseType}
                  onChange={(e) => setNewClientLicenseType(e.target.value)}
                >
                  <option value="monocaja">Monocaja (1 Caja)</option>
                  <option value="multicajas">Multicajas (Ilimitado)</option>
                  <option value="personalizado">Personalizado (Elegir cantidad)</option>
                </select>
              </div>
              {newClientLicenseType === "personalizado" && (
                <div className="input-group mt-2">
                  <label>Número de Cajas</label>
                  <input
                    type="number"
                    min="1"
                    value={newClientMaxRegisters}
                    onChange={(e) => setNewClientMaxRegisters(e.target.value)}
                    required
                  />
                </div>
              )}
```

**Step 7: Update Edit Modal Form Fields**

Add the `"personalizado"` option and custom number input in the Edit Modal.

```jsx
              <div className="input-group mt-4">
                <label>Tipo de Licencia</label>
                <select
                  value={editLicenseType}
                  onChange={(e) => setEditLicenseType(e.target.value)}
                >
                  <option value="monocaja">Monocaja (1 Caja)</option>
                  <option value="multicajas">Multicajas (Ilimitado)</option>
                  <option value="personalizado">Personalizado (Elegir cantidad)</option>
                </select>
              </div>
              {editLicenseType === "personalizado" && (
                <div className="input-group mt-2">
                  <label>Número de Cajas</label>
                  <input
                    type="number"
                    min="1"
                    value={editLicenseMaxRegisters}
                    onChange={(e) => setEditLicenseMaxRegisters(e.target.value)}
                    required
                  />
                </div>
              )}
```

**Step 8: Commit**

```bash
git add frontend/src/pages/SuperAdmin/SuperAdminPortal.jsx
git commit -m "feat: implement custom license register limits in superadmin portal"
```
