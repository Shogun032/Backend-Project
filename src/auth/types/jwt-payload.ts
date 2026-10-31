import { AuthUser } from '../../common/types/auth-user';

export interface JwtPayload {
  sub: string; //รหัสผู้ใช้
  role: AuthUser['role']; //สิทธิ์ USER หรือ ADMIN
  jti: string; //รหัส Token ID
  iat: number; //วันเวลาที่ออก
  exp: number; //วันเวลาที่หมดอายุ
}
