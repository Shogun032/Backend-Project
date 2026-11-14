# Hotel Booking API

โปรเจกต์ทีม 3 คน ใช้ NestJS 11 + TypeScript สำหรับระบบจองห้องพัก

## สถานะปัจจุบัน

ทำแล้ว: Register, Login/JWT, ดู/แก้โปรไฟล์, Logout ผ่าน Redis, คำสั่งสร้าง Admin, JWT/Role Guards, Validation, Error Filter และ Request ID พร้อม Swagger ของ Users/Auth/Rooms/Bookings/Notifications รวมถึง Rate limiting และ Security Log ของงานคนที่ 1 ใน Sprint 3

ข้อมูลผู้ใช้บันทึกใน MySQL ผ่าน UsersRepository → PrismaService แล้ว ไม่หายเมื่อแอปรีสตาร์ต PrismaModule เปิดให้โมดูลอื่นใช้ตัวเชื่อมร่วมกัน และปิดการเชื่อมต่อเมื่อแอปถูกปิดผ่าน Nest lifecycle

รวมฐานงานคนที่ 2 แล้ว: Prisma 6 + MySQL, migration ของ Room/RoomImage, seed ห้องตัวอย่าง, Docker Compose สำหรับ MySQL/Redis และโครง RoomsModule

เพิ่ม User model/migration และเชื่อม Auth กับ MySQL แล้ว email เป็น unique โดยจัดการคำขอสมัครซ้ำพร้อมกันด้วย constraint ของฐานข้อมูล

รวมฐานงานคนที่ 3 แล้ว: ตาราง Booking/Notification พร้อม migration, API สร้าง/ดู/ยกเลิก Booking, Admin เปลี่ยนสถานะ และรายการ Notification

Users/Auth Sprint 2 เพิ่ม PATCH /users/me และ POST /auth/logout แล้ว Logout คืน 204 และบันทึก jti ใน Redis จน JWT หมดอายุ Guard ตรวจการเพิกถอนทุก protected request: Token ถูกเพิกถอนคืน 401 และ Redis ใช้งานไม่ได้คืน 503

Rooms Sprint 2 มี Public list/detail/search และ Admin CRUD พร้อมรูปภาพ การกรองสถานะ Pagination, Swagger และ Integration tests แล้ว ใช้คำสั่งเฉพาะด้านล่างเพื่อสร้าง Admin

Security Sprint 3 เพิ่ม ThrottlerGuard ส่วนกลาง, limit เฉพาะ Login/สร้าง Booking, ตัวนับ Redis ร่วมกันใน production, Swagger 429/Retry-After, Log ของ Auth/Profile และ HTTP errors พร้อม validation Environment และ proxy แล้ว งานที่ยังค้าง ได้แก่ Health check, โครงสร้างพื้นฐาน/Deploy และการยืนยันค่ากับเซิร์ฟเวอร์จริง

## ส่งต่องาน Sprint 1 และเริ่ม Sprint 2

ฐานงาน Auth, Rooms/Database และ Bookings/Notifications รวมเข้าด้วยกันแล้ว พร้อมเทสต์ regression สำหรับการเชื่อมโมดูลและคำขอพร้อมกัน ผลทดสอบปัจจุบันดูหัวข้อ ทดสอบ ด้านล่าง

หลังรับโค้ดล่าสุด ให้ commit งานใน branch ของตัวเองก่อน แล้วดึง main มารวมโดยไม่ทิ้งงานเดิม ผู้ที่อยู่ main และไม่มีงานค้างใช้:

```bash
git pull --ff-only origin main
npm ci
npx prisma generate
docker compose up -d
# รอ MySQL healthy ก่อนรันคำสั่งต่อไป
npx prisma migrate deploy
npm run start:dev
```

ต้องตั้ง `.env` ให้ตรงกับ MySQL ของเครื่องก่อนตามหัวข้อ Setup ด้านล่าง ไม่ต้อง reset ฐานข้อมูลหรือแก้ migration เดิม หลังอัปเดต schema ต้อง generate Client ใหม่เพื่อลดปัญหา Property 'user'/'booking' does not exist

ให้สมาชิกแต่ละคนลอง setup/run บนเครื่องตนเองก่อนยืนยันปิด Sprint 1 การมีฐานงานพร้อมไม่ได้หมายความว่า FR ทั้งระบบเสร็จแล้ว งานรวมระบบที่ยังค้างระบุไว้ในสถานะปัจจุบันข้างบน

## Setup ครั้งแรก

ใช้ Node.js ตาม `.nvmrc` (24.14.0) และ npm

```bash
# ถ้าใช้ nvm
nvm install
nvm use

npm ci
cp .env.example .env
```

Windows PowerShell ใช้ `Copy-Item .env.example .env` แทนคำสั่ง copy ข้างบน

สร้าง Secret ของเครื่องตัวเอง:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

นำผลลัพธ์ไปใส่ `JWT_SECRET` ใน `.env` และใช้ `JWT_EXPIRES_IN=900` (15 นาที) แอปจะปฏิเสธ Secret ที่ว่าง/เป็นค่าตัวอย่าง และอายุ Token ที่ไม่ใช่จำนวนเต็มบวก อย่าส่ง `.env` หรือ Secret จริงขึ้น Git

| Environment | หน้าที่ |
| --- | --- |
| `PORT` | พอร์ต API ค่าเริ่มต้น 3000 |
| `JWT_SECRET` | Secret สำหรับลงลายเซ็นและตรวจ JWT |
| `JWT_EXPIRES_IN` | อายุ Token หน่วยวินาที ค่าในตัวอย่าง 900 |
| `TZ` | เขตเวลาเครื่องพัฒนา ในตัวอย่างใช้ Asia/Bangkok |
| `DATABASE_URL`, `REDIS_URL` | DATABASE_URL ใช้กับ Prisma; REDIS_URL ใช้ตรวจและบันทึกการเพิกถอน JWT |

ต้องเปิด MySQL และรัน migration ตามหัวข้อ Database/Redis ด้านล่างก่อนเริ่มแอป Protected API และ Logout ต้องใช้ Redis ด้วย

หลัง npm ci ให้สร้าง Prisma Client ตาม schema ล่าสุดด้วย `npx prisma generate`

```bash
npm run build
npm run start:dev
```

- Business API: `http://localhost:3000/api/v1`
- Swagger: `http://localhost:3000/docs`
- OpenAPI JSON: `http://localhost:3000/docs-json`

Swagger ของ Users/Auth, Rooms, Bookings และ Notifications มี Request/Response schemas, error examples และ Bearer authentication ตามสิทธิ์ของแต่ละ endpoint แล้ว ถ้าเจอ `EADDRINUSE` ให้หยุดเซิร์ฟเวอร์เดิมด้วย Ctrl+C และเปิดเพียงหนึ่งตัว

## Database/Redis จาก branch คนที่ 2

ติดตั้งและเปิด Docker ก่อน หากมี `.env` อยู่แล้วให้เพิ่มค่าจาก `.env.example` โดยรักษา JWT_SECRET เดิมไว้:

```dotenv
MYSQL_ROOT_PASSWORD=change_me
MYSQL_DATABASE=hotel_booking
MYSQL_PORT=3306
REDIS_PORT=6379
DATABASE_URL="mysql://root:change_me@localhost:3306/hotel_booking"
REDIS_URL="redis://localhost:6379"
```

ค่าข้างบนเป็นตัวอย่างสำหรับพัฒนาในเครื่อง ให้รหัสผ่าน/พอร์ตใน DATABASE_URL ตรงกับ Compose ถ้า MySQL volume เคยสร้างแล้ว การเปลี่ยนตัวแปรรหัสผ่านจะไม่เปลี่ยนรหัสผ่านในฐานข้อมูลเดิมอัตโนมัติ

```bash
docker compose up -d
docker compose ps
npx prisma generate
npx prisma migrate deploy
```

รอ MySQL และ Redis healthy ก่อน migrate ตรวจข้อมูลผ่าน `npx prisma studio` ได้ หลังใช้งานหยุดบริการด้วย `docker compose stop` โดยไม่ลบ volume

เพิ่มห้องตัวอย่างสำหรับพัฒนา:

```bash
npx prisma db seed
```

Seed ใช้ ID คงที่สำหรับห้องตัวอย่าง 5 ห้อง เพิ่มเฉพาะห้องที่ยังไม่มี รันซ้ำไม่เพิ่มห้อง/รูปซ้ำ ไม่แก้ห้องที่มีอยู่ และไม่ลบ User, Booking หรือ Notification รูปเป็น URL ตัวอย่าง หากเคยใช้ Seed รุ่นเก่าที่สุ่ม ID ห้องเดิมจะยังอยู่ และจะเพิ่มห้องชุด ID คงที่ครั้งแรกโดยไม่ล้างข้อมูลอัตโนมัติ ดูการใช้ API ในหัวข้อ Rooms API (คนที่ 2) ด้านล่าง

Compose เปิดพอร์ต MySQL/Redis สำหรับพัฒนาในเครื่อง ยังไม่ใช่ configuration สำหรับ deploy production

## ลอง Register, Login และ Profile

เปิด Terminal อีกแท็บขณะเซิร์ฟเวอร์ทำงาน สมัครครั้งแรกตามตัวอย่าง หากอีเมลนี้มีอยู่แล้วจะได้ 409 ให้ Login ต่อได้ ไม่ต้องสมัครใหม่หลังรีสตาร์ตแอป:

```bash
curl -i -X POST http://localhost:3000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Mint","email":"mint@example.com","password":"TestPassword123!"}'

curl -i -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"mint@example.com","password":"TestPassword123!"}'
```

Login สำเร็จได้ HTTP 200 และ `{ data: { accessToken, tokenType, expiresIn, user }, message }` ให้นำ `data.accessToken` มาแทน `YOUR_TOKEN` ทั้งหมด โดยคง `Bearer` และช่องว่างไว้:

```bash
curl -i http://localhost:3000/api/v1/users/me \
  -H 'Authorization: Bearer YOUR_TOKEN'
```

Token ถูกต้องได้ 200 ไม่มี/ผิด/หมดอายุได้ 401 Login ผิดได้ 401 อีเมลสมัครซ้ำได้ 409 ข้อมูลไม่ผ่าน Validation ได้ 400 ไม่คืน password หรือ passwordHash

Register สำเร็จคืน HTTP 201 พร้อม `{ data: User, message }` และ Header `Location: /api/v1/users/me` ผู้ใช้ต้อง Login ก่อนอ่านโปรไฟล์

แก้โปรไฟล์และ Logout ด้วย Token ที่ได้จาก Login:

```bash
curl -i -X PATCH http://localhost:3000/api/v1/users/me \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -d '{"name":"Mint Updated"}'

curl -i -X POST http://localhost:3000/api/v1/auth/logout \
  -H 'Authorization: Bearer YOUR_TOKEN'
```

PATCH รับเฉพาะ name/email อย่างน้อยหนึ่งฟิลด์ ปฏิเสธ null, role และ password อีเมลถูกตัดช่องว่าง/เปลี่ยนเป็นตัวพิมพ์เล็ก ถ้าซ้ำบัญชีอื่นได้ 409 Logout สำเร็จได้ 204 ไม่มี body Token เดิมใช้ต่อไม่ได้ (401) ให้ Login เพื่อรับ Token ใหม่

## สร้างบัญชี Admin สำหรับพัฒนา

เปิด MySQL และรัน migrations ก่อน แล้วตั้งค่าใน `.env` ของเครื่องตัวเอง (มีชื่อค่าตัวอย่างใน `.env.example`):

```dotenv
ADMIN_NAME="Development Admin"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="ใส่รหัสผ่านสำหรับพัฒนาที่ตั้งเอง"
```

ใช้รหัสผ่าน 8–128 ตัวอักษร ไม่ commit `.env` หรือรหัสผ่านจริง จากนั้นรัน:

```bash
npm run admin:create
```

คำสั่งโหลด `.env`, ตรวจข้อมูล, hash ด้วย Argon2 แล้วสร้าง role ADMIN ใน MySQL ถ้ามีอีเมลนี้อยู่แล้วจะหยุดด้วย exit code 1 ไม่เขียนทับรหัสผ่านและไม่เปลี่ยน USER เดิมเป็น ADMIN ห้ามเปลี่ยน Register ให้รับ role จาก client

Login ผ่าน `/api/v1/auth/login` ด้วยข้อมูล Admin ที่ตั้งไว้ แล้วใช้ Token เรียก `/api/v1/admin/bookings` ควรได้ 200 ส่วน Token ของ USER ได้ 403 อย่าใส่รหัสผ่านจริงในตัวอย่างเอกสารหรือภาพส่งงาน

## ให้โมดูลของเพื่อนใช้ Guard

ในโมดูลของตัวเอง เพิ่ม `TokenModule` ใน `imports` โดยเก็บรายการเดิมไว้ด้วย (ปรับ relative path ตามตำแหน่งไฟล์):

```ts
import { TokenModule } from '../auth/token.module';

@Module({
  imports: [TokenModule],
  // controllers และ providers ของโมดูลตัวเอง
})
export class RoomsModule {}
```

API ที่ต้อง Login ใช้ `@UseGuards(JwtAuthGuard)` ส่วน API สำหรับ Admin ใช้ JWT Guard ก่อน Roles Guard เสมอ:

```ts
import { Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('rooms')
export class RoomsController {
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  createRoom() {
    // เรียก Service ของโมดูลตัวเอง
  }
}
```

นี่เป็นตัวอย่างวิธีใช้ Guard สำหรับโมดูลอื่น รายละเอียด Rooms API จริงอยู่ด้านล่าง การ import TokenModule อย่างเดียวไม่เปิด Guard อัตโนมัติ Public routes ไม่ต้องใส่ Guard

หลัง JWT Guard ตรวจผ่าน จะมี:

```ts
request.user = { id: 'user-uuid', role: 'USER' }; // หรือ ADMIN
```

อ่านผู้ใช้ใน Controller ได้ด้วย:

```ts
import { Req } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/guards/jwt-auth.guard';

// ภายใน method ที่ป้องกันด้วย JwtAuthGuard
// @Req() request: AuthenticatedRequest
// ใช้ request.user.id และ request.user.role
```

ใช้ `request.user.id` เป็นเจ้าของ Booking ห้ามเชื่อถือ userId/role ที่ client ส่งมา การตรวจว่าเป็นเจ้าของ resource ต้องทำเพิ่มในโมดูลนั้นเอง Guard ตรวจ Token/Role ไม่ได้ตรวจ Ownership ให้

JWT มี `sub` (รหัสผู้ใช้), `role`, `jti` (รหัส Token), `iat`, `exp` และใช้ HS256 ชื่อ role ใช้ตัวพิมพ์ใหญ่ `USER`/`ADMIN` เสมอ Register สร้างได้เฉพาะ USER บัญชี ADMIN ใน E2E test เป็นข้อมูลเฉพาะเทสต์และถูกล้างหลังเสร็จ ส่วนบัญชีพัฒนาให้สร้างผ่าน npm run admin:create

## Bookings และ Notifications ที่เชื่อมกับ Auth แล้ว

ทุกเส้นทางด้านล่างต้องส่ง `Authorization: Bearer <accessToken>`:

| Method | Path ใต้ /api/v1 | สิทธิ์ |
| --- | --- | --- |
| POST | /bookings | USER/ADMIN จองให้ตัวเอง |
| GET | /bookings | รายการของตัวเอง รองรับ page, limit, status |
| GET | /bookings/:bookingId | เจ้าของเท่านั้น |
| PATCH | /bookings/:bookingId/status | เจ้าของ ส่ง status=CANCELLED เท่านั้น |
| GET | /admin/bookings | ADMIN รองรับ page, limit, status, userId, roomId |
| GET | /admin/bookings/:bookingId | ADMIN |
| PATCH | /admin/bookings/:bookingId/status | ADMIN ส่ง APPROVED/PAID/CANCELLED ตามกติกา |
| GET | /notifications | รายการของตัวเอง รองรับ page, limit |

Create รับเฉพาะ roomId, checkIn, checkOut, guests ใช้วัน YYYY-MM-DD และคำนวณราคาจากห้องฝั่ง server Response วันพักเป็น YYYY-MM-DD เงินเป็น decimal string 2 ตำแหน่ง และ Create ส่ง Location header

`src/bookings/booking-rules.ts` เป็นจุดร่วมสำหรับวันที่ Bangkok, สถานะที่กันห้อง และ overlap predicate ให้ Search ของคนที่ 2 import `blockingOverlap()` ไปใช้เพื่อให้ใช้กติกาเดียวกับ Booking ช่วงพักไม่รวมวันออก จึงเข้าวันเดียวกับวันออกของคนก่อนได้

ทุกการสร้าง/เปลี่ยนสถานะ Booking ล็อก Room แถวเดียวกันภายใน transaction ก่อนตรวจข้อมูลล่าสุด ใช้ Read Committed เพื่อให้การอ่านหลังได้ lock เห็นสถานะล่าสุด การแก้/ปิด/ลบห้องใน Sprint 2 ต้องใช้ Room lock เดียวกันด้วย จึงจะป้องกันการแก้ข้อมูลห้องชนกับการจองครบทั้งระบบ

Notification เก็บ bookingId อย่างเดียว แล้วอ่าน userId ผ่าน Booking ตอนคืน API สร้างเฉพาะ BOOKING_CREATED/BOOKING_CANCELLED ใน transaction เดียวกับ Booking การส่งสถานะเดิมซ้ำไม่สร้าง event ซ้ำ การอนุมัติ/จ่ายเงินไม่สร้าง Notification เพิ่ม

Schema จาก migration เดิมมี nights/currency ใน Booking และ isRead ใน Notification อยู่แล้ว เก็บไว้เพื่อให้ใช้กับ migration ที่ merge แล้วได้ แต่ไม่เพิ่ม mark-as-read API และไม่คืน isRead ใน response ไม่ต้อง reset ฐานข้อมูลหรือแก้ migration เก่า

### ตัวอย่าง Booking และ Notification

Login ด้วยบัญชี User และ Admin ตามหัวข้อ Auth แล้วแทน `USER_TOKEN`, `ADMIN_TOKEN`, `ROOM_ID` และ `BOOKING_ID` ด้วยค่าจริง ตัวอย่างวันที่ต้องเปลี่ยนเป็นวันอนาคตตาม Asia/Bangkok (ยกเลิกได้ก่อนวันเช็กอินเท่านั้น)

```bash
# ค้นหาห้องว่างและนำ data[].id ไปแทน ROOM_ID
curl -i 'http://localhost:3000/api/v1/rooms/search?checkIn=2027-01-10&checkOut=2027-01-12&guests=2'

# สร้างการจอง แล้วนำ data.id ไปแทน BOOKING_ID
curl -i -X POST http://localhost:3000/api/v1/bookings \
  -H 'Authorization: Bearer USER_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"roomId":"ROOM_ID","checkIn":"2027-01-10","checkOut":"2027-01-12","guests":2}'

curl -i 'http://localhost:3000/api/v1/bookings?page=1&limit=20&status=PENDING' \
  -H 'Authorization: Bearer USER_TOKEN'

curl -i http://localhost:3000/api/v1/bookings/BOOKING_ID \
  -H 'Authorization: Bearer USER_TOKEN'

# เจ้าของยกเลิก PENDING/APPROVED ก่อนวันเข้า
curl -i -X PATCH http://localhost:3000/api/v1/bookings/BOOKING_ID/status \
  -H 'Authorization: Bearer USER_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"status":"CANCELLED"}'

curl -i 'http://localhost:3000/api/v1/notifications?page=1&limit=20' \
  -H 'Authorization: Bearer USER_TOKEN'

# Admin จัดการรายการอื่นที่ยังไม่ยกเลิก: PENDING → APPROVED → PAID
curl -i -X PATCH http://localhost:3000/api/v1/admin/bookings/BOOKING_ID/status \
  -H 'Authorization: Bearer ADMIN_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"status":"APPROVED"}'
```

Create สำเร็จได้ 201 พร้อม Location; ดู/ยกเลิกได้ 200 การใช้ ID ของคนอื่นผ่าน Owner route ได้ 404 และการจองทับซ้อนได้ 409 ROOM_UNAVAILABLE การอนุมัติ/บันทึก PAID ใช้ได้ถึงวันเช็กอินและไม่สร้าง Notification ส่วนการยกเลิกสร้าง BOOKING_CANCELLED ให้เจ้าของเพียงครั้งเดียว

## Security — Sprint 3 (คนที่ 1)

### Rate limiting

AppModule ลงทะเบียน `ThrottlerGuard` ผ่าน `APP_GUARD` ใช้ตรวจจำนวนคำขอก่อนเข้า Controller แล้วให้ `@Throttle()` เปลี่ยน limit เฉพาะเส้นทาง กติกาปัจจุบันคือ:

| เส้นทาง | จำนวนคำขอสูงสุด | ช่วงเวลา |
| --- | --- | --- |
| `POST /api/v1/auth/login` | 5 | 60,000 ms (1 นาที) |
| `POST /api/v1/bookings` | 10 | 60,000 ms (1 นาที) |
| Business endpoints อื่นที่ผ่าน Guard | 100 | 60,000 ms (1 นาที) |

นับตาม IP ที่แอปเห็น (`request.ip`) แยกตาม Controller/handler ไม่ได้นับตามบัญชีผู้ใช้ และนับทั้งคำขอสำเร็จ/ล้มเหลว ผู้ใช้ที่ออกผ่าน IP เดียวกันจึงอาจใช้โควตาของเส้นทางเดียวกันร่วมกันได้

เมื่อเกินกำหนดได้ HTTP 429, `error.code: RATE_LIMITED` พร้อม `Retry-After` หน่วยวินาที ให้รอตาม Header ก่อนลองใหม่ และมี `X-Request-Id` สำหรับตาม Log ตัวอย่าง Response:

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "ThrottlerException: Too Many Requests",
    "details": []
  },
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

Swagger ของ endpoint ที่ใช้ `@ApiErrorResponses()` มี 429 example และประกาศ `Retry-After` เป็น integer ใน response headers แล้ว

ลองด้วยบัญชีทดสอบที่ไม่มีอยู่ โดยใช้ Terminal อีกแท็บขณะ API ทำงาน:

```bash
for i in {1..6}; do
  curl -s -o /dev/null -w "Request $i: %{http_code}\n" \
    -X POST http://localhost:3000/api/v1/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"rate-limit-check@example.com","password":"WrongPassword123!"}'
done
```

บนรอบที่ไม่มีคำขอเดิมค้างอยู่ 5 ครั้งแรกควรได้ 401 และครั้งที่ 6 ได้ 429 คำขอจาก Swagger/curl ที่มาจาก IP เดียวกันใช้ตัวนับเดียวกันได้ ใช้ `curl -i` เพื่อดู Header และเปลี่ยนข้อมูลตัวอย่างให้เป็นข้อมูลทดสอบเท่านั้น

เลือกตัวเก็บตัวนับด้วย `RATE_LIMIT_STORAGE`: development/test ใช้ `memory` เป็นค่าเริ่มต้น ส่วน production ใช้ `redis` และจะปฏิเสธการเลือก memory ตัวเลข limit/ttl ยังกำหนดในโค้ดตามตารางข้างบน

โหมด Redis ใช้ sliding window และบันทึกการนับ/ตรวจ/บล็อกด้วย Lua script ในคำสั่งเดียว ใช้เวลาจาก Redis และเก็บ key แบบมีอายุ API ทุก instance ที่ใช้ Redis DB และ `RATE_LIMIT_PREFIX` เดียวกันจึงแบ่งโควตาร่วมกัน โควตาไม่เริ่มใหม่เมื่อรีสตาร์ตเฉพาะ API; ถ้า Redis ใช้งานไม่ได้ API คืน 503 โดยไม่ข้าม Rate limiting อัตโนมัติ ส่วนโหมด memory ยังคงแยกตัวนับต่อ process และเริ่มใหม่เมื่อรีสตาร์ต

Redis ตอนนี้ใช้ทั้งเพิกถอน JWT และเก็บตัวนับ Rate limit ในโหมด redis ต้องวางแผนความพร้อมใช้งาน/การเก็บข้อมูลของ Redis ด้วย เพราะการล้างข้อมูล Redis จะทำให้ทั้งตัวนับและข้อมูลเพิกถอน Token หายไป ห้ามใช้คำสั่ง FLUSHDB/FLUSHALL กับ Redis ที่ใช้ร่วมกับแอป

### Security Log

`LoggingModule` ลงทะเบียนและ export `SecurityLoggerService` ให้ AuthModule, UsersModule และ AppModule ใช้ร่วมกัน Log ออกทาง Nest Logger ใน Terminal ของ API; เมื่อรันใน container ให้อ่านจาก container logs ไม่ได้บันทึกลงฐานข้อมูลหรือไฟล์โดยอัตโนมัติ

| เหตุการณ์ | ระดับ | จุดที่เรียก |
| --- | --- | --- |
| `AUTH_REGISTER_SUCCESS` | LOG | หลังสร้างผู้ใช้สำเร็จ |
| `AUTH_LOGIN_SUCCESS` | LOG | หลัง Login และออก Token สำเร็จ |
| `AUTH_LOGIN_FAILURE` | LOG | AuthController รับ Error 401 จาก Login |
| `AUTH_LOGOUT_SUCCESS` | LOG | หลัง Redis บันทึกการเพิกถอน Token สำเร็จ |
| `PROFILE_UPDATE_SUCCESS` | LOG | หลังแก้โปรไฟล์สำเร็จ |
| `HTTP_REQUEST_REJECTED` | WARN | Error Filter รับ 403 หรือ 429 |
| `HTTP_SERVER_ERROR` | ERROR | Error Filter รับ 5xx |

Auth/Profile Log มีเฉพาะ `event`, `requestId`, `userId` โดยไม่ใส่ userId เมื่อไม่ทราบผู้ใช้ ส่วน HTTP error Log มีเฉพาะ `event`, `requestId`, `status` ไม่ส่ง request body, Authorization header, URL/query, password/hash, Token หรือ Error/stack trace ดิบเข้า Logger ตัวนี้ ตัวอย่างข้อมูล Log:

```text
{"event":"AUTH_LOGIN_SUCCESS","requestId":"request-uuid","userId":"user-uuid"}
{"event":"HTTP_REQUEST_REJECTED","requestId":"request-uuid","status":429}
```

`AUTH_LOGIN_FAILURE` ไม่ได้ครอบคลุมทุก 401 ของระบบ: กรณี JWT Guard ปฏิเสธ Token ยังไม่ถึง AuthController และ HTTP error Log ปัจจุบันเลือกเฉพาะ 403/429/5xx ส่วน Log สำเร็จวางหลัง `await` เพื่อไม่รายงาน Success ถ้างานล้มเหลว Seed ใช้ข้อความ Error คงที่และ exit code 1 โดยรอปิด Prisma ใน `finally`

API Response แยกจาก Log: Login ยังคืน `accessToken` ให้ผู้ใช้ตาม contract แต่ไม่เขียนลง Log; Register/Profile ไม่คืน password/hash และ 5xx คืนข้อความทั่วไปพร้อม requestId

## Error และ Validation กลาง

AppModule ลงทะเบียน Validation Pipe และ Error Filter แบบ global แล้ว โมดูลอื่นไม่ต้องลงทะเบียนซ้ำ DTO ต้องใส่ decorator ของ class-validator เพื่อให้ตรวจข้อมูลได้ ฟิลด์ที่ไม่ได้ประกาศจะถูกปฏิเสธ

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": [{ "field": "email", "message": "email must be an email" }]
  },
  "requestId": "request-uuid"
}
```

ทุกคำขอที่ผ่าน RequestIdMiddleware มี Header `X-Request-Id` และใน Error JSON จะใช้รหัสเดียวกัน details เป็น Array เสมอ ข้อผิดพลาด 5xx ส่งข้อความทั่วไปโดยไม่เปิดเผยรายละเอียดภายใน Error Filter เรียก SecurityLoggerService บันทึก 403/429/5xx โดยใช้ requestId เดียวกับ Header และ Body รายละเอียดอยู่ในหัวข้อ Security — Sprint 3

ถ้าต้องระบุ business error เฉพาะ ให้ใช้:

```ts
import { ApiException } from '../common/exceptions/api.exception';

throw new ApiException(409, 'ROOM_UNAVAILABLE', 'Room unavailable');
```

รหัส Auth ที่มีแล้ว: `EMAIL_ALREADY_EXISTS`, `INVALID_CREDENTIALS`, `UNAUTHORIZED`, `FORBIDDEN`, `RESOURCE_NOT_FOUND` และ `VALIDATION_ERROR` ถ้าใช้ ConflictException ทั่วไปจะได้ `CONFLICT` จึงควรใช้ ApiException เมื่อต้องการรหัสตาม Agreement

## ทดสอบ

ชุด `npm test` ประกอบด้วย Unit tests และ HTTP integration tests ที่จำลอง Service/ฐานข้อมูล จึงไม่ต้องเปิด MySQL/Redis ส่วน E2E ใช้ MySQL และ Redis จริงแยกสำหรับทดสอบ ไม่ต้องเปิดเซิร์ฟเวอร์ API แยก

สร้างฐานข้อมูลสำหรับทดสอบชื่อ `hotel_booking_test` แยกจากฐานข้อมูลพัฒนา แล้วกำหนด TEST_DATABASE_URL ใน Terminal (แก้ค่าตัวอย่างให้ตรงกับ MySQL ของตัวเอง):

```bash
export TEST_DATABASE_URL='mysql://root:change_me@localhost:3306/hotel_booking_test'
# เปลี่ยน URL ให้ตรงกับ Redis instance ที่เปิดแยกสำหรับเทสต์
export TEST_REDIS_URL='redis://localhost:6380/0'
DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate deploy
```

E2E ต้องมี TEST_REDIS_URL ที่ชี้ไปยัง Redis สำหรับเทสต์โดยเฉพาะ และจะหยุดทันทีถ้าไม่มี TEST_DATABASE_URL หรือชื่อฐานข้อมูลไม่ลงท้าย `_test` เพื่อไม่ให้เขียนลงฐานข้อมูลพัฒนาโดยเผลอ เทสต์สร้างบัญชีชื่อเฉพาะแต่ละรอบและลบเฉพาะบัญชีที่ตัวเองสร้างเมื่อเสร็จ ถ้าเทสต์ถูกหยุดกลางทางอาจมีข้อมูลทดสอบค้างอยู่

```bash
npm run build
npx eslint "{src,test}/**/*.ts"
npm test -- --runInBand
npm run test:e2e -- --runInBand
```

Unit tests ครอบคลุมวันที่ไม่จริง/อดีต/คืนศูนย์, วันเปลี่ยนตาม Bangkok และกติกาเปลี่ยนสถานะ

E2E ครอบคลุมจองพร้อมกัน, วันพักติดกัน, ราคาจองเดิมไม่เปลี่ยน, ownership, Admin status, ยกเลิกพร้อมกันไม่แจ้งซ้ำ, Notification userId/pagination และข้อมูลคงอยู่หลังสร้างแอปใหม่, สมัครพร้อมกันและ unique constraint, Register/Login/Profile, Token ผิด/ไม่มี, ADMIN ได้ 200/USER ได้ 403, Request ID, Validation, อีเมลซ้ำ, Login ผิด และการปิดบัง Error ภายใน Route `test-admin` มีเฉพาะแอปในเทสต์ ไม่ใช่ API จริง

ชุดทดสอบ Users/Auth Sprint 2 ครอบคลุมแก้โปรไฟล์, email unique, สิทธิ์, Logout 204/Token เดิม 401, session อื่นยังใช้งานได้, expiry ของ key ตรงกับ JWT exp, revoked token ยังถูกปฏิเสธหลังเปิดแอปใหม่ และจำลอง Redis error ได้ 503 เพิ่ม E2E สำหรับ OpenAPI contract และคำสั่งสร้าง Admin ด้วย

### ผลตรวจล่าสุดและเทสต์ Security

ผลตรวจในเครื่องวันที่ 15 พ.ย. 2026 ด้วย MySQL/Redis ชุดทดสอบแยก:

| การตรวจ | ผล |
| --- | --- |
| `npm test -- --runInBand` | 16 suites, 132 tests ผ่าน |
| `npm run test:e2e -- --runInBand` | 9 suites, 85 tests ผ่าน |
| TypeScript, Build และ ESLint | ผ่าน |
| Production-mode smoke ในเครื่อง | 2 Node processes ใช้ MySQL/Redis แยก; Admin/JWT/Profile/Logout และโควตาร่วมกันผ่าน |

ผลนี้รวม production mode ในเครื่อง แต่ยังไม่ใช่ผล Deploy บน public server ต้องตั้ง Secret จริง, ยืนยัน proxy/TLS และทดสอบ Authentication กับ URL จริงก่อนยืนยันงาน Deploy

ไฟล์ Security ที่เพิ่มใน Sprint 3:

| ไฟล์ | สิ่งที่ตรวจ |
| --- | --- |
| `src/auth/rate-limits.spec.ts` | HTTP requests ผ่าน AppModule/Guard จริง โดยจำลอง Service/DB: Login ครั้งที่ 6 และ Booking ที่ไม่มี Token ครั้งที่ 11 ได้ 429 พร้อม Retry-After |
| `src/common/logging/security-logger.service.spec.ts` | ข้อมูล Log ตาม field ที่กำหนด และกรณีไม่ทราบ userId |
| `src/auth/auth.controller.spec.ts` | Log ของ Register/Login/Logout, ไม่ใส่ข้อมูลลับ, ไม่รายงาน Success เมื่องานล้มเหลว และ Logout รอเพิกถอน Token เสร็จก่อน Log |
| `src/users/users.controller.spec.ts` | Log ตอนแก้โปรไฟล์สำเร็จ และไม่พิมพ์ Error ดิบเมื่องานล้มเหลว |
| `src/common/filters/api-exception.filter.spec.ts` | WARN/ERROR ตามสถานะ, การซ่อน Error ภายใน และ requestId ตรงกันใน Log/Header/Body |
| `src/config/environment.spec.ts` | ค่า production ที่ขาด/ผิด/เป็นค่าตัวอย่าง, Secret ขั้นต่ำ, URL และ proxy ที่ไม่ปลอดภัย โดยไม่เปิดเผยค่าจริงใน Error |
| `src/config/http.config.spec.ts` | ทดสอบ HTTP ว่าไม่เชื่อ Header จากแหล่งที่ไม่ใช่ proxy และใช้ IP ฝั่ง client ที่ถูกต้องเมื่อมี proxy ที่เชื่อถือ |
| `src/common/rate-limit/redis-throttler.storage.spec.ts` | Redis ไม่พร้อม/ตอบผิดรูปแบบต้องปฏิเสธคำขอด้วย 503 |
| `test/rate-limit-redis.e2e-spec.ts` | โควตาข้ามแอปพร้อมกัน, รีสตาร์ต API, Redis ล้มเหลว, proxy/header spoof และการหมดอายุ block ด้วย Redis จริง |

รันเฉพาะส่วนที่ต้องการตรวจ เช่น:

```bash
npm test -- --runInBand rate-limits.spec.ts
npm test -- --runInBand auth.controller.spec.ts users.controller.spec.ts security-logger.service.spec.ts api-exception.filter.spec.ts
npm run test:e2e -- --runInBand auth.e2e-spec.ts profile.e2e-spec.ts logout.e2e-spec.ts bookings.e2e-spec.ts
npm run test:e2e -- --runInBand rate-limit-redis.e2e-spec.ts
```

ชุด functional E2E เลือก memory ชัดเจนใน `test/setup-env.ts` แล้วเรียก `test/helpers/reset-rate-limits.ts` ใน `beforeEach` เพื่อล้างเฉพาะตัวนับ in-memory ของแอปทดสอบก่อนเริ่มแต่ละเคส ภายในเคสยังใช้ Guard/limit จริง ไม่มีการปิด Rate limiting หรือแก้ MySQL/Redis ใน helper นี้ เทสต์ที่ทดสอบ 429 โดยตรงเก็บตัวนับตลอดเคสเพื่อยืนยันว่าเกินกำหนดแล้วถูกบล็อก ส่วนชุด shared Redis ใช้ prefix สุ่มของตัวเองแต่ละเคส ลบเฉพาะ key ของตัวเอง และไม่เรียก helper สำหรับ memory

ระหว่าง E2E อาจเห็น Security Log ระดับ ERROR ของ 500/503 จากเคสที่จงใจจำลองระบบล้มเหลว ให้ดูผล PASS/FAIL ของ Jest ประกอบ ไม่ถือว่าเป็นเทสต์ล้มเหลวเพียงเพราะมี Log ระดับ ERROR

## ทำงานร่วมกัน

- คนที่ 1: Users/Auth, JWT/Role Guards, Validation และ Error กลาง (`feat/auth`)
- คนที่ 2: Database/ORM, Rooms/RoomImages, Seed และ Compose (`feat/rooms`)
- คนที่ 3: Bookings/Notifications และกติกาวันที่/การจอง (`feat/bookings`)

ก่อนแก้ไฟล์กลาง เช่น app.module.ts, package.json, package-lock.json, ORM schema และ Migration ให้แจ้งทีม คนที่ 2 ประสานการรวม schema/migration UsersRepository ใช้ Prisma แล้ว เมธอดค้นหาคืน Promise<User | null> และ create คืน Promise<User> ผู้เรียกต้อง await เมื่อจะใช้ผลลัพธ์

### กติกาส่งงานเข้า main

- ทุกคนทำงานใน branch ของตัวเอง แล้ว push ขึ้น branch นั้น
- การนำงานเข้า `main` ต้องเปิด Pull Request เท่านั้น โดยตั้ง `base: main` และ `compare: branch ของตัวเอง`
- ห้าม push โค้ดตรงเข้า `main` และห้ามกด Merge Pull Request เอง
- **คนที่ 1 (Shogun) เป็นผู้ตรวจและ merge เข้า `main` เพียงคนเดียว** เมื่อเปิด PR แล้วให้แจ้งคนที่ 1 เพื่อตรวจและรวมงาน
- ใน PR ให้ระบุสิ่งที่เปลี่ยน วิธีทดสอบ ผลทดสอบ และแจ้งหากแก้ไฟล์กลางหรือ API contract
- หาก PR มี conflict ให้แก้บน branch ของตัวเองแล้ว push อัปเดต PR เดิม โดยประสานคนที่ 1 เมื่อเกี่ยวข้องกับไฟล์กลาง

Commit package-lock.json เสมอ ผู้รับโค้ดใช้ npm ci ไม่ส่ง .env, node_modules หรือ dist ขึ้น Git

กติกานี้เป็นข้อตกลงของทีมใน README การบังคับสิทธิ์ผ่าน GitHub branch protection/ruleset ยังต้องตั้งค่าแยกต่างหาก

เอกสารอ้างอิงใน repo: Project_Description.pdf, Hotel_Booking_API_Agreement.pdf และ Hotel_Booking_Database_Simple.pdf โครงปัจจุบันเป็นฐานพัฒนา ยังไม่ใช่ระบบที่ทำครบทุกข้อในเอกสาร

ชุดทดสอบ Rooms ครอบคลุม CRUD/รูปภาพ, สิทธิ์ Admin, ห้องปิดใช้งาน, Search/วันพักติดกัน/การยกเลิก, Validation/Pagination, ป้องกันลดความจุและลบห้องที่มีการจอง, Swagger และ Seed ที่รันซ้ำโดยรักษาข้อมูลเดิม ดูผลตรวจล่าสุดในหัวข้อ ทดสอบ

## Rooms API (คนที่ 2)

### เตรียมข้อมูลห้องสำหรับพัฒนา

```bash
npx prisma migrate deploy
npx prisma db seed   # สร้างห้องตัวอย่าง 5 ห้อง (เปิด 4 ห้อง ปิด 1 ห้อง)
npm run start:dev
```

Seed เพิ่มเฉพาะห้องตัวอย่าง ID คงที่ที่ยังไม่มี รันซ้ำไม่สร้างห้อง/รูปซ้ำ ไม่แก้ห้องเดิม และไม่ลบการจองหรือ Notification ใช้สำหรับข้อมูลตัวอย่างในการพัฒนา

### Endpoint

| Method | Path | สิทธิ์ | หมายเหตุ |
| --- | --- | --- | --- |
| GET | `/api/v1/rooms` | ทุกคน | เฉพาะห้อง Active; `page`, `limit` |
| GET | `/api/v1/rooms/search` | ทุกคน | ต้องมี `checkIn`, `checkOut`, `guests` |
| GET | `/api/v1/rooms/{roomId}` | ทุกคน | ห้อง Inactive คืน 404 |
| GET | `/api/v1/admin/rooms` | ADMIN | รวม Active/Inactive; กรอง `isActive=true\|false` ได้ |
| GET | `/api/v1/admin/rooms/{roomId}` | ADMIN | ห้องทุกสถานะ |
| POST | `/api/v1/rooms` | ADMIN | 201 พร้อม `Location` ไปที่ admin detail |
| PATCH | `/api/v1/rooms/{roomId}` | ADMIN | ต้องมีอย่างน้อยหนึ่งฟิลด์; ส่ง `images` = แทนที่รูปทั้งหมด |
| DELETE | `/api/v1/rooms/{roomId}` | ADMIN | 204; ห้องที่มีประวัติการจองลบไม่ได้ ให้ PATCH `isActive=false` แทน |

### กติกาที่ใช้

- `pricePerNight` รับและคืนเป็น decimal string เช่น `"1500.00"` มากกว่า 0 และไม่เกิน `9999999.99`; response มี `currency: "THB"`
- รูปเรียงตาม `sortOrder` และต้องเป็น URL แบบ HTTPS
- Search ใช้ `parseBookingDates` และ `blockingOverlap` จาก `src/bookings/booking-rules.ts` ตัวเดียวกับการสร้างการจอง ช่วงพักคือ `[checkIn, checkOut)` และ PENDING/APPROVED/PAID กันห้อง ผลค้นหาเป็นข้อมูล ณ เวลาค้น การจองจริงยังตรวจซ้ำใน transaction
- PATCH และ DELETE ห้องล็อกแถว Room (`SELECT ... FOR UPDATE`) ก่อนอ่านข้อมูล แบบเดียวกับ BookingsService

### ตัวอย่างการเรียก

```bash
# ดูห้องที่เปิดรับจอง
curl "http://localhost:3000/api/v1/rooms?page=1&limit=20"

# ค้นห้องว่าง
curl "http://localhost:3000/api/v1/rooms/search?checkIn=2027-01-10&checkOut=2027-01-12&guests=2"

# ADMIN สร้างห้อง
curl -X POST http://localhost:3000/api/v1/rooms \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Deluxe Double","capacity":2,"pricePerNight":"1800.00","images":[{"url":"https://example.com/rooms/double-1.jpg","altText":"Queen bed","sortOrder":0}]}'

# ADMIN ปิดห้อง (หยุดรับจองใหม่ การจองเดิมยังอยู่)
curl -X PATCH http://localhost:3000/api/v1/rooms/<roomId> \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"isActive":false}'

# ADMIN ลบห้องที่ไม่มีประวัติการจอง
curl -X DELETE http://localhost:3000/api/v1/rooms/<roomId> \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

ตัวอย่าง response ของห้อง

```json
{
  "data": {
    "id": "<room-uuid>",
    "name": "Deluxe Double",
    "description": "",
    "capacity": 2,
    "pricePerNight": "1800.00",
    "currency": "THB",
    "isActive": true,
    "images": [
      { "url": "https://example.com/rooms/double-1.jpg", "altText": "Queen bed", "sortOrder": 0 }
    ],
    "createdAt": "2026-11-03T17:59:24.419Z",
    "updatedAt": "2026-11-03T17:59:24.419Z"
  },
  "message": "Room created"
}
```

### Error ที่ Rooms ใช้

| HTTP | `error.code` | เมื่อ |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | ข้อมูลผิด, UUID ผิด, PATCH ว่าง, วันที่ค้นหาไม่ถูกต้อง |
| 401 / 403 | `UNAUTHORIZED` / `FORBIDDEN` | ไม่มี token หรือไม่ใช่ ADMIN |
| 404 | `RESOURCE_NOT_FOUND` | ไม่พบห้อง หรือห้อง Inactive ใน public route |
| 409 | `ROOM_HAS_BOOKINGS` | ลบห้องที่มีประวัติการจอง |
| 409 | `ROOM_CAPACITY_CONFLICT` | ลด capacity ต่ำกว่า guests ของการจองที่ยังกันห้องและยังไม่สิ้นสุด |

### Test

```bash
npm test -- rooms
```

## ทำงานต่อใน Sprint 3

ฐาน Sprint 2 รวมแล้ว และเพิ่มงาน Security ของคนที่ 1 ตามรายละเอียดในหัวข้อ Security — Sprint 3 ผลทดสอบล่าสุดอยู่ในหัวข้อ ทดสอบ

รวมงาน Users/Auth, Rooms และ Bookings/Notifications ของ Sprint 2 แล้ว ชุดตรวจรวมครอบคลุม Admin สร้างห้อง → User สมัคร/Login → ค้นหา → จอง → ดูรายการ/รายละเอียด → ยกเลิก/รับ Notification รวมถึงห้ามเข้าถึงการจองคนอื่นและปฏิเสธการจองทับซ้อน พร้อม Unit tests และ Swagger contract tests

ก่อนเริ่มงานใหม่ให้เก็บงานเดิมใน branch ของตัวเอง แล้วอัปเดตฐานจาก main:

```bash
git switch main
git pull --ff-only origin main
npm ci
npx prisma generate
docker compose up -d
# รอ MySQL และ Redis healthy
npx prisma migrate deploy
git switch -c feat/your-sprint3-task
npm run start:dev
```

ไม่ต้อง reset ฐานข้อมูลหรือแก้ migration เดิม Seed เป็นตัวเลือกสำหรับเพิ่มห้องตัวอย่างเท่านั้น งานใหม่ส่งผ่าน PR ตามกติกาทีม และให้ Shogun เป็นผู้รวมเข้า main

งานที่ยังต้องทำร่วมกันก่อนปิด Sprint 3 คือ Health check/โครงสร้างพื้นฐาน, การตรวจ Environment และ Secrets สำหรับ production, การตรวจ proxy/ตัวนับ Rate limit, การรีวิวงานเพื่อนอย่างน้อยคนละ 1 โมดูล และการทดสอบบนเซิร์ฟเวอร์จริงร่วมกัน ผลทดสอบในเครื่องยังไม่ใช่การยืนยันว่า Deploy สำเร็จหรือทำครบทุก requirement ของโครงการ

## เตรียม Environment และ Security สำหรับ Deploy

Project Description กำหนดให้ใช้ Docker และ Deploy ไปยังเซิร์ฟเวอร์ที่ให้มาหรือ public server พร้อม URL และขั้นตอนใน README ไม่ได้บังคับผู้ให้บริการ, Nginx หรือหลาย instance รายละเอียดในเอกสารหน้า 2 และ Task 7–8 หน้า 3–4 ให้คนที่ 2 ยืนยันโครงสร้างพื้นฐานจริงก่อนตั้งค่า proxy

ใช้ `deploy/production.env.example` เป็นแม่แบบที่ไม่มี Secret จริง ค่าตัวอย่างตั้งใจให้ไม่ผ่าน validation จนกว่าจะใส่ค่าจริง ห้าม commit Environment ของเซิร์ฟเวอร์หรือฝัง Secret ใน Dockerfile/image ให้ส่งค่าผ่านระบบ Secrets/Environment ของผู้ให้บริการหรือ Docker `--env-file` ที่เก็บนอก source code

| ค่า | กติกาที่ตรวจตอนเริ่มแอป |
| --- | --- |
| `NODE_ENV` | development/test/production; ตั้ง production จากภายนอก process เพื่อไม่ให้ Nest ConfigModule โหลด `.env` ของเครื่องพัฒนา |
| `PORT` | จำนวนเต็ม 1–65535; ค่าเริ่มต้น 3000 |
| `JWT_SECRET` | ห้ามว่างหรือใช้ค่าตัวอย่าง; production ต้องอย่างน้อย 32 bytes ให้ใช้ค่าสุ่มและใช้ค่าเดียวกันทุก API instance |
| `JWT_EXPIRES_IN` | จำนวนเต็มบวก หน่วยวินาที; ค่าเริ่มต้น 900 |
| `DATABASE_URL` | MySQL URL ที่เลือกฐานข้อมูล; production ต้องมี username/password ที่ไม่ใช่ค่าตัวอย่าง |
| `REDIS_URL` | redis:// หรือ rediss://; production ต้องมี password ที่ไม่ใช่ค่าตัวอย่าง และต้องเปิด authentication ฝั่ง Redis ให้ตรงกัน |
| `RATE_LIMIT_STORAGE` | memory/redis; production เริ่มต้นเป็น redis และปฏิเสธ memory |
| `RATE_LIMIT_PREFIX` | ค่าเดียวกันทุก instance ใน environment เดียวกัน แยกจาก staging/test; อนุญาตตัวอักษร ตัวเลข `:` `_` `-` สูงสุด 100 ตัวอักษร |
| `TRUST_PROXY` | ค่าเริ่มต้น false; รับ loopback หรือรายการ IP/CIDR ของ proxy จริง คั่นด้วย comma; ไม่รับ true, hop count, `0.0.0.0/0` หรือ `::/0` |

การตรวจค่าไม่ใส่ค่าที่กรอกลงในข้อความ Error จึงไม่ควรพิมพ์ `process.env` หรือ Connection URL เพื่อ debug รหัสผ่านที่มีอักขระพิเศษใน URL ต้อง URL-encode ก่อน เก็บฐานข้อมูล/Redis ไว้ในเครือข่ายที่เหมาะสมและกำหนดสิทธิ์ผู้ใช้บริการให้พอดี ใช้ rediss:// เมื่อการเชื่อมต่อ Redis ต้องผ่าน TLS

### Proxy และ HTTPS

เมื่อยังไม่ทราบรูปแบบ Deploy ให้คง `TRUST_PROXY=false` ไว้ หากแอปอยู่หลัง reverse proxy ให้ตั้งเฉพาะ IP/CIDR ของ proxy ที่เข้าถึงแอปจริง เช่น `TRUST_PROXY=10.20.0.2` หรือ loopback เมื่อ proxy เชื่อมผ่าน loopback จริง ตัวอย่างไม่ใช่ค่าที่ใช้ได้กับทุกเซิร์ฟเวอร์

proxy ต้องจัดการ/เขียนทับ Forwarded headers ให้ถูกต้อง และควรจำกัดทางเข้า API ให้รับจาก proxy ที่กำหนด การตั้ง trust proxy เพียงอย่างเดียวไม่ได้ป้องกันการเข้าถึง API โดยตรง ต้องยืนยันเส้นทางเครือข่ายจริงร่วมกับคนที่ 2 แอปใช้ client IP ที่ใกล้กับฝั่งแอปและยังไม่ถูกกำหนดให้เชื่อถือ ไม่เชื่อค่า X-Forwarded-For ฝั่งซ้ายสุดโดยอัตโนมัติ

ให้บริการ URL ภายนอกผ่าน HTTPS และตรวจ TLS termination ที่ proxy/แพลตฟอร์มจริง โค้ดยังไม่ได้ใส่ใบรับรองหรือบังคับ HTTPS redirect เพราะยังไม่ได้กำหนดผู้ให้บริการและรูปแบบ proxy

อ้างอิงการตั้งค่า: [Express behind proxies](https://expressjs.com/en/guide/behind-proxies/), [NestJS rate limiting](https://docs.nestjs.com/security/rate-limiting), [Redis Lua scripts และ atomic execution](https://redis.io/docs/latest/develop/programmability/eval-intro/)

### คำสั่งของแอปเมื่อใช้ Environment จากระบบ Deploy

```bash
# ขั้น Build; รัน migration ในขั้น Deploy กับฐานข้อมูลเป้าหมายตามแผนทีม
npm ci
npx prisma generate
npm run build

# ระบบ Deploy ต้อง inject Environment และ Secret จริงก่อนรัน
npm run start:prod
```

ผล Build ปัจจุบันอยู่ที่ `dist/src/main.js` เพราะมี scripts/seed อยู่ในโปรเจกต์ด้วย `start:prod` ชี้มาที่ไฟล์นี้แล้ว หากต้องสร้าง Admin บนเซิร์ฟเวอร์ ให้ส่ง ADMIN_NAME/ADMIN_EMAIL/ADMIN_PASSWORD ชั่วคราวให้คำสั่ง `npm run admin:create:prod` ซึ่งใช้ไฟล์ Build `dist/scripts/create-admin.js` ไม่ต้องใช้ ts-node และไม่เขียนทับบัญชีที่มีอยู่ นำ ADMIN_* ออกจาก Environment ของงานนั้นเมื่อเสร็จ

API instances ต้องใช้ MySQL/Redis ที่ตั้งใจแชร์, JWT_SECRET เดียวกัน และ RATE_LIMIT_PREFIX เดียวกัน การรักษาข้อมูลเพิกถอน JWT และตัวนับขึ้นอยู่กับ Redis persistence/availability ที่คนที่ 2 เตรียม การทดสอบนี้ยืนยันการรีสตาร์ตเฉพาะ API ไม่ได้ยืนยันการคงข้อมูลหลัง Redis ถูกล้างหรือรีสตาร์ตโดยไม่มี persistence

### สิ่งที่ยังต้องยืนยันบนเซิร์ฟเวอร์จริง

- ผู้ให้บริการ, จำนวน instance และ proxy/TLS ที่ใช้จริง พร้อม URL ของ API/Swagger
- Environment/Secret จริง, การเข้าถึง MySQL/Redis และการเก็บข้อมูลของบริการเหล่านั้น
- ทดสอบ Login/Profile/Admin/Logout และ Token ที่หมดอายุ/ถูกเพิกถอนผ่าน URL ภายนอก
- ทดสอบ 429 และ Retry-After จาก client จริง และข้าม instance หากมีหลายตัว
- คนที่ 2 จัดทำ production Dockerfile/Compose/Health check ตามงานทีม และบันทึกขั้นตอน Deploy จริง; โค้ดใน branch นี้ยังไม่ได้สร้างส่วนเหล่านั้นแทน
