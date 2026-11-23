import express from 'express';
import { store } from '../services/store.js';

const router = express.Router();

// GET /api/equipment - Query catalogue with search and filter
router.get('/', (req, res) => {
  try {
    const { search, department, category, status } = req.query;
    let list = store.getEquipment();

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(e =>
        e.name.toLowerCase().includes(q) ||
        e.model.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.labRoom.toLowerCase().includes(q)
      );
    }

    if (department && department !== 'all') {
      const depQ = decodeURIComponent(department).trim().toLowerCase();
      list = list.filter(e => 
        e.department.toLowerCase() === depQ || 
        e.department.toLowerCase().includes(depQ)
      );
    }

    if (category && category !== 'all') {
      list = list.filter(e => e.category === category);
    }

    if (status && status !== 'all') {
      list = list.filter(e => e.status === status);
    }

    res.json({
      success: true,
      count: list.length,
      data: list
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/equipment/:id - Single equipment details with maintenance info
router.get('/:id', (req, res) => {
  const item = store.getEquipmentById(req.params.id);
  if (!item) {
    return res.status(404).json({ success: false, error: 'Equipment not found' });
  }

  const maintenance = store.getMaintenanceWindows().filter(m => m.equipmentId === item.id);
  const activeBookings = store.getBookings().filter(b => b.equipmentId === item.id && b.status === 'confirmed');

  res.json({
    success: true,
    data: {
      ...item,
      scheduledMaintenance: maintenance,
      activeBookings
    }
  });
});

export default router;
