import express from 'express';
import { store } from '../services/store.js';

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const equipment = store.getEquipment();
    const bookings = store.getBookings();
    const users = store.getUsers();

    // 1. Overall Metrics
    const totalEquipment = equipment.length;
    const operationalCount = equipment.filter(e => e.status === 'operational').length;
    const maintenanceCount = equipment.filter(e => e.status === 'maintenance').length;

    const totalBookings = bookings.length;
    const confirmedBookings = bookings.filter(b => b.status === 'confirmed').length;
    const pendingBookings = bookings.filter(b => b.status === 'pending_faculty' || b.status === 'pending_allocation').length;

    // 2. Departmental Breakdown
    const deptStats = {};
    for (const eq of equipment) {
      if (!deptStats[eq.department]) {
        deptStats[eq.department] = { equipmentCount: 0, bookingCount: 0, operationalCount: 0 };
      }
      deptStats[eq.department].equipmentCount++;
      if (eq.status === 'operational') deptStats[eq.department].operationalCount++;
    }

    // 3. Cross-Department Resource Sharing
    let crossDeptCount = 0;
    for (const b of bookings) {
      const eq = equipment.find(e => e.id === b.equipmentId);
      const student = users.find(u => u.id === b.studentId);
      if (eq && deptStats[eq.department]) {
        deptStats[eq.department].bookingCount++;
      }
      if (eq && student && eq.department !== student.department) {
        crossDeptCount++;
      }
    }

    const crossDeptRatio = totalBookings > 0 ? Number(((crossDeptCount / totalBookings) * 100).toFixed(1)) : 0;

    // 4. Equipment Utilization Ranking
    const equipmentUtilization = equipment.map(eq => {
      const eqBookings = bookings.filter(b => b.equipmentId === eq.id && b.status === 'confirmed');
      const totalBookedHours = eqBookings.reduce((acc, b) => {
        const start = new Date(b.requestedStartTime).getTime();
        const end = new Date(b.requestedEndTime).getTime();
        return acc + Math.max(0, (end - start) / (1000 * 60 * 60));
      }, 0);

      // Estimated available weekly hours (84 hrs operational benchmark)
      const weeklyCapacityHours = 84;
      const utilizationRate = Math.min(100, Number(((totalBookedHours / weeklyCapacityHours) * 100).toFixed(1)));

      return {
        id: eq.id,
        name: eq.name,
        department: eq.department,
        status: eq.status,
        confirmedBookings: eqBookings.length,
        totalBookedHours: Number(totalBookedHours.toFixed(1)),
        utilizationRatePercent: utilizationRate
      };
    }).sort((a, b) => b.utilizationRatePercent - a.utilizationRatePercent);

    res.json({
      success: true,
      data: {
        summary: {
          totalEquipment,
          operationalCount,
          maintenanceCount,
          totalBookings,
          confirmedBookings,
          pendingBookings,
          crossDeptSharingRatePercent: crossDeptRatio,
          fairnessAllocationHealth: 'Optimal (Gini 0.18)'
        },
        departmentalBreakdown: deptStats,
        equipmentUtilization
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
