# Hotel Booking API

โปรเจกต์ทีม 3 คน ใช้ NestJS 11 + TypeScript สำหรับระบบจองห้องพัก

## สถานะปัจจุบัน

ทำแล้ว: Register, Login/JWT, ดู/แก้โปรไฟล์, Logout ผ่าน Redis, คำสั่งสร้าง Admin, JWT/Role Guards, Validation, Error Filter และ Request ID พร้อม Swagger ของ Users/Auth

ข้อมูลผู้ใช้บันทึกใน MySQL ผ่าน UsersRepository → PrismaService แล้ว ไม่หายเมื่อแอปรีสตาร์ต PrismaModule เปิดให้โมดูลอื่นใช้ตัวเชื่อมร่วมกัน และปิดการเชื่อมต่อเมื่อแอปถูกปิดผ่าน Nest lifecycle

รวมฐานงานคนที่ 2 แล้ว: Prisma 6 + MySQL, migration ของ Room/RoomImage, seed ห้องตัวอย่าง, Docker Compose สำหรับ MySQL/Redis และโครง RoomsModule

เพิ่ม User model/migration และเชื่อม Auth กับ MySQL แล้ว email เป็น unique โดยจัดการคำขอสมัครซ้ำพร้อมกันด้วย constraint ของฐานข้อมูล

รวมฐานงานคนที่ 3 แล้ว: ตาราง Booking/Notification พร้อม migration, API สร้าง/ดู/ยกเลิก Booking, Admin เปลี่ยนสถานะ และรายการ Notification

Users/Auth Sprint 2 เพิ่ม PATCH /users/me สำหรับแก้ชื่อ/อีเมล และ POST /auth/logout แล้ว Logout ใช้ JWT Guard และคืน 204 โดยไม่มี body เก็บ jti ใน Redis จนถึง exp ของ JWT Guard ตรวจ Redis ทุก protected request: Token ถูกเพิกถอนคืน 401 และ Redis ตรวจสอบ/บันทึกไม่ได้คืน 503 Logout มีผลเฉพาะ Token ที่ส่งมา ไม่ยกเลิก session อื่น

งานรวมระบบที่ยังค้าง: rate limiting, Health check, Rooms CRUD/Search และเอกสาร Swagger ของโมดูลอื่นให้ครบ ไม่มีบัญชี ADMIN จากการสมัครทั่วไป ให้ใช้คำสั่งเฉพาะด้านล่าง

## ส่งต่องาน Sprint 1 และเริ่ม Sprint 2

ฐานงาน Auth, Rooms/Database และ Bookings/Notifications รวมเข้าด้วยกันแล้ว พร้อมเทสต์ regression สำหรับการเชื่อมโมดูลและคำขอพร้อมกัน ผลตรวจชุดนี้: Build/ESLint ผ่าน, Unit tests 10 เคส และ E2E กับ MySQL จริง 17 เคสผ่าน

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

ให้สมาชิกแต่ละคนลอง setup/run บนเครื่องตนเองก่อนยืนยันปิด Sprint 1 การมีฐานงานพร้อมไม่ได้หมายความว่า FR ทั้งระบบเสร็จแล้ว งาน Sprint 2 ที่ยังค้างระบุไว้ในสถานะปัจจุบันข้างบน

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

Swagger ของ Users/Auth มี Request/Response schemas, error examples, กลุ่ม Auth/Users และ Bearer authentication แล้ว เอกสารของโมดูลอื่นยังต้องเติมต่อ ถ้าเจอ `EADDRINUSE` ให้หยุดเซิร์ฟเวอร์เดิมด้วย Ctrl+C และเปิดเพียงหนึ่งตัว

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

สำหรับฐานข้อมูลพัฒนาที่ไม่มีข้อมูลต้องเก็บเท่านั้น:

```bash
npx prisma db seed
```

**Seed ปัจจุบันล้าง RoomImage และ Room ทั้งหมดก่อนสร้างห้องตัวอย่าง 5 ห้อง** อย่ารันกับฐานข้อมูลที่มีข้อมูลต้องเก็บ รูปใน seed เป็น URL ตัวอย่าง Schema มี User/Room/RoomImage/Booking/Notification และผู้ใช้จาก Register บันทึกลง MySQL แล้ว RoomsController มีรายการห้อง Active เบื้องต้น แต่ยังไม่ครบ CRUD/Search และ pagination ตามข้อตกลง

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

นี่เป็นตัวอย่างวิธีใช้ ไม่ใช่ Rooms API ที่ทำเสร็จแล้ว การ import TokenModule อย่างเดียวไม่เปิด Guard อัตโนมัติ Public routes ไม่ต้องใส่ Guard

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

ทุกคำขอมี Header `X-Request-Id` และใน Error JSON จะใช้รหัสเดียวกัน details เป็น Array เสมอ ข้อผิดพลาด 5xx ส่งข้อความทั่วไปโดยไม่เปิดเผยรายละเอียดภายใน ขณะนี้ยังไม่ได้เพิ่มระบบ Log กลาง

ถ้าต้องระบุ business error เฉพาะ ให้ใช้:

```ts
import { ApiException } from '../common/exceptions/api.exception';

throw new ApiException(409, 'ROOM_UNAVAILABLE', 'Room unavailable');
```

รหัส Auth ที่มีแล้ว: `EMAIL_ALREADY_EXISTS`, `INVALID_CREDENTIALS`, `UNAUTHORIZED`, `FORBIDDEN`, `RESOURCE_NOT_FOUND` และ `VALIDATION_ERROR` ถ้าใช้ ConflictException ทั่วไปจะได้ `CONFLICT` จึงควรใช้ ApiException เมื่อต้องการรหัสตาม Agreement

## ทดสอบ

Unit tests ไม่ต้องใช้ฐานข้อมูล ส่วน E2E ใช้ MySQL และ Redis จริงแยกสำหรับทดสอบ ไม่ต้องเปิดเซิร์ฟเวอร์ API แยก

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
npm test -- --runInBand
npm run test:e2e -- --runInBand
```

Unit tests ครอบคลุมวันที่ไม่จริง/อดีต/คืนศูนย์, วันเปลี่ยนตาม Bangkok และกติกาเปลี่ยนสถานะ

E2E ครอบคลุมจองพร้อมกัน, วันพักติดกัน, ราคาจองเดิมไม่เปลี่ยน, ownership, Admin status, ยกเลิกพร้อมกันไม่แจ้งซ้ำ, Notification userId/pagination และข้อมูลคงอยู่หลังสร้างแอปใหม่, สมัครพร้อมกันและ unique constraint, Register/Login/Profile, Token ผิด/ไม่มี, ADMIN ได้ 200/USER ได้ 403, Request ID, Validation, อีเมลซ้ำ, Login ผิด และการปิดบัง Error ภายใน Route `test-admin` มีเฉพาะแอปในเทสต์ ไม่ใช่ API จริง

ชุดทดสอบ Users/Auth Sprint 2 ครอบคลุมแก้โปรไฟล์, email unique, สิทธิ์, Logout 204/Token เดิม 401, session อื่นยังใช้งานได้, expiry ของ key ตรงกับ JWT exp, revoked token ยังถูกปฏิเสธหลังเปิดแอปใหม่ และจำลอง Redis error ได้ 503 เพิ่ม E2E สำหรับ OpenAPI contract และคำสั่งสร้าง Admin ด้วย ผลตรวจ Users/Auth Sprint 2: Build/ESLint ผ่าน, Unit tests 14 เคส และ E2E กับ MySQL/Redis จริง 51 เคสผ่าน

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
