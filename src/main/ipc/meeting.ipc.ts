import { ipcMain } from 'electron';
import { db } from '../database';
import { v4 as uuidv4 } from 'uuid';

export function registerMeetingHandlers(): void {
  // ========================================
  // 회의실 예약 목록 조회
  // ========================================
  ipcMain.handle('meeting:getAll', async (_event, requesterId: string, filters?: any) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) {
        return { success: false, error: '권한이 없습니다.' };
      }

      let reservations = await db.getMeetingReservations();

      // 슈퍼관리자가 아니면 자기 회사의 예약만 조회
      if (requester.role !== 'super_admin' && requester.company_id) {
        reservations = reservations.filter((r: any) => r.company_id === requester.company_id);
      }

      // 날짜 필터
      if (filters?.date) {
        reservations = reservations.filter((r: any) => r.reservation_date === filters.date);
      }

      // 월 필터
      if (filters?.month) {
        reservations = reservations.filter((r: any) => {
          return r.reservation_date?.startsWith(filters.month);
        });
      }

      // 정렬: 날짜 -> 시작시간 순
      reservations.sort((a: any, b: any) => {
        const dateCompare = (a.reservation_date || '').localeCompare(b.reservation_date || '');
        if (dateCompare !== 0) return dateCompare;
        return (a.start_time || '').localeCompare(b.start_time || '');
      });

      return { success: true, reservations };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ========================================
  // 회의실 예약 생성
  // ========================================
  ipcMain.handle('meeting:create', async (_event, requesterId: string, data: any) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) {
        return { success: false, error: '사용자를 찾을 수 없습니다.' };
      }

      const now = new Date().toISOString();
      const reservation = {
        id: uuidv4(),
        company_id: requester.company_id,
        title: data.title,
        department: data.department || requester.department_name || '',
        reserved_by: requesterId,
        reserved_by_name: requester.name,
        reservation_date: data.reservation_date,
        start_time: data.start_time,
        end_time: data.end_time,
        attendees: data.attendees || 1,
        phone: data.phone || null,
        email: data.email || null,
        notes: data.notes || null,
        created_at: now,
        updated_at: now,
      };

      // 시간 중복 체크
      let existingReservations = await db.getMeetingReservations();
      if (requester.company_id) {
        existingReservations = existingReservations.filter(
          (r: any) => r.company_id === requester.company_id
        );
      }
      const sameDate = existingReservations.filter(
        (r: any) => r.reservation_date === data.reservation_date
      );

      const hasConflict = sameDate.some((r: any) => {
        return data.start_time < r.end_time && data.end_time > r.start_time;
      });

      if (hasConflict) {
        return { success: false, error: '해당 시간에 이미 예약이 있습니다.' };
      }

      await db.addMeetingReservation(reservation);

      return { success: true, reservation };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ========================================
  // 회의실 예약 수정
  // ========================================
  ipcMain.handle('meeting:update', async (_event, requesterId: string, reservationId: string, data: any) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) {
        return { success: false, error: '권한이 없습니다.' };
      }

      const reservations = await db.getMeetingReservations();
      const reservation = reservations.find((r: any) => r.id === reservationId);
      if (!reservation) {
        return { success: false, error: '예약을 찾을 수 없습니다.' };
      }

      // 본인 또는 관리자만 수정 가능
      if (reservation.reserved_by !== requesterId &&
          requester.role !== 'super_admin' &&
          requester.role !== 'company_admin') {
        return { success: false, error: '수정 권한이 없습니다.' };
      }

      // 시간 중복 체크 (자기 자신 제외)
      if (data.reservation_date && data.start_time && data.end_time) {
        let existingReservations = await db.getMeetingReservations();
        if (requester.company_id) {
          existingReservations = existingReservations.filter(
            (r: any) => r.company_id === requester.company_id
          );
        }
        const sameDate = existingReservations.filter(
          (r: any) => r.reservation_date === data.reservation_date && r.id !== reservationId
        );

        const hasConflict = sameDate.some((r: any) => {
          return data.start_time < r.end_time && data.end_time > r.start_time;
        });

        if (hasConflict) {
          return { success: false, error: '해당 시간에 이미 예약이 있습니다.' };
        }
      }

      const updates: any = {
        updated_at: new Date().toISOString(),
      };
      if (data.title !== undefined) updates.title = data.title;
      if (data.department !== undefined) updates.department = data.department;
      if (data.reservation_date !== undefined) updates.reservation_date = data.reservation_date;
      if (data.start_time !== undefined) updates.start_time = data.start_time;
      if (data.end_time !== undefined) updates.end_time = data.end_time;
      if (data.attendees !== undefined) updates.attendees = data.attendees;
      if (data.phone !== undefined) updates.phone = data.phone;
      if (data.email !== undefined) updates.email = data.email;
      if (data.notes !== undefined) updates.notes = data.notes;

      await db.updateMeetingReservation(reservationId, updates);

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ========================================
  // 회의실 예약 삭제
  // ========================================
  ipcMain.handle('meeting:delete', async (_event, requesterId: string, reservationId: string) => {
    try {
      const requester = await db.getUserById(requesterId);
      if (!requester) {
        return { success: false, error: '권한이 없습니다.' };
      }

      const reservations = await db.getMeetingReservations();
      const reservation = reservations.find((r: any) => r.id === reservationId);
      if (!reservation) {
        return { success: false, error: '예약을 찾을 수 없습니다.' };
      }

      // 본인 또는 관리자만 삭제 가능
      if (reservation.reserved_by !== requesterId &&
          requester.role !== 'super_admin' &&
          requester.role !== 'company_admin') {
        return { success: false, error: '삭제 권한이 없습니다.' };
      }

      await db.deleteMeetingReservation(reservationId);

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });
}
