import { ipcMain } from 'electron';
import { db } from '../database';
import { v4 as uuidv4 } from 'uuid';

const ADMIN_ROLES = ['super_admin', 'company_admin'];

export function registerVehicleHandlers(): void {
  // ============ Vehicles ============
  ipcMain.handle('vehicles:getAll', async (_e, requesterId: string, filters?: any) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '권한이 없습니다.' };
      let companyId: string | null = requester.company_id;
      if (requester.role === 'super_admin') {
        // 슈퍼관리자: 회사 필터 있으면 해당 회사, 없으면 모든 회사
        companyId = filters?.company_id || null;
      }
      const list = await db.getVehicles(companyId);
      return { success: true, data: list };
    } catch (error: any) {
      return { success: false, error: error.message || '조회 실패' };
    }
  });

  ipcMain.handle('vehicles:create', async (_e, requesterId: string, data: any) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '권한이 없습니다.' };
      if (!ADMIN_ROLES.includes(requester.role)) return { success: false, error: '등록 권한이 없습니다.' };
      const record = {
        id: uuidv4(),
        company_id: data.company_id || requester.company_id,
        plate_number: data.plate_number || '',
        vehicle_type: data.vehicle_type || '',
        model: data.model || '',
        color: data.color || '',
        notes: data.notes || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const result = await db.addVehicle(record);
      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error: error.message || '등록 실패' };
    }
  });

  ipcMain.handle('vehicles:update', async (_e, requesterId: string, id: string, data: any) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '권한이 없습니다.' };
      if (!ADMIN_ROLES.includes(requester.role)) return { success: false, error: '수정 권한이 없습니다.' };
      const result = await db.updateVehicle(id, data);
      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error: error.message || '수정 실패' };
    }
  });

  ipcMain.handle('vehicles:delete', async (_e, requesterId: string, id: string) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '권한이 없습니다.' };
      if (!ADMIN_ROLES.includes(requester.role)) return { success: false, error: '삭제 권한이 없습니다.' };
      // 회사 격리: super_admin은 모두, company_admin은 자기 회사 또는 공통(NULL) 차량만 삭제 가능
      if (requester.role !== 'super_admin') {
        const target = await db.getVehicleById(id);
        if (!target) return { success: false, error: '대상 차량을 찾을 수 없습니다.' };
        if (target.company_id && target.company_id !== requester.company_id) {
          return { success: false, error: '다른 회사 차량은 삭제할 수 없습니다.' };
        }
      }
      await db.deleteVehicle(id);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || '삭제 실패' };
    }
  });

  // ============ Vehicle Logs ============
  ipcMain.handle('vehicleLogs:getAll', async (_e, requesterId: string, filters?: any) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '권한이 없습니다.' };
      let companyId: string | null = requester.company_id;
      if (requester.role === 'super_admin') {
        companyId = filters?.company_id || null;
      }
      const driverFilter = ADMIN_ROLES.includes(requester.role) || requester.role === 'department_manager' ? undefined : requesterId;
      const list = await db.getVehicleLogs(companyId, driverFilter);
      return { success: true, data: list };
    } catch (error: any) {
      return { success: false, error: error.message || '조회 실패' };
    }
  });

  ipcMain.handle('vehicleLogs:create', async (_e, requesterId: string, data: any) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '권한이 없습니다.' };
      const record = {
        id: uuidv4(),
        company_id: data.company_id || requester.company_id,
        vehicle_id: data.vehicle_id,
        driver_id: data.driver_id || requesterId,
        driver_name: data.driver_name || requester.name || '',
        log_date: data.log_date,
        departure: data.departure || '',
        destination: data.destination || '',
        start_time: data.start_time || '',
        end_time: data.end_time || '',
        purpose: data.purpose || '',
        distance_km: data.distance_km || 0,
        fuel_cost: data.fuel_cost || 0,
        notes: data.notes || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const result = await db.addVehicleLog(record);
      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error: error.message || '등록 실패' };
    }
  });

  ipcMain.handle('vehicleLogs:update', async (_e, requesterId: string, id: string, data: any) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '권한이 없습니다.' };
      const existing = await db.getVehicleLogById(id);
      if (!existing) return { success: false, error: '운행일지를 찾을 수 없습니다.' };
      if (existing.driver_id !== requesterId && !ADMIN_ROLES.includes(requester.role)) {
        return { success: false, error: '수정 권한이 없습니다.' };
      }
      const result = await db.updateVehicleLog(id, data);
      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error: error.message || '수정 실패' };
    }
  });

  ipcMain.handle('vehicleLogs:delete', async (_e, requesterId: string, id: string) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) return { success: false, error: '권한이 없습니다.' };
      const existing = await db.getVehicleLogById(id);
      if (!existing) return { success: false, error: '운행일지를 찾을 수 없습니다.' };
      if (existing.driver_id !== requesterId && !ADMIN_ROLES.includes(requester.role)) {
        return { success: false, error: '삭제 권한이 없습니다.' };
      }
      await db.deleteVehicleLog(id);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || '삭제 실패' };
    }
  });
}
