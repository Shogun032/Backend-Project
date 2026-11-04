import { Prisma } from '@prisma/client';

// ใช้ include นี้ทุกครั้งที่ดึงห้อง เพื่อให้รูปเรียงตาม sortOrder เสมอ
export const ROOM_INCLUDE = {
  images: { orderBy: { sortOrder: 'asc' as const } },
};

type RoomWithImages = Prisma.RoomGetPayload<{ include: { images: true } }>;

// รูปแบบ Room response ตามข้อตกลง API หัวข้อ 2
export function toRoomResponse(room: RoomWithImages) {
  return {
    id: room.id,
    name: room.name,
    description: room.description,
    capacity: room.capacity,
    pricePerNight: room.pricePerNight.toFixed(2),
    currency: 'THB',
    isActive: room.isActive,
    images: room.images.map((image) => ({
      url: image.url,
      altText: image.altText,
      sortOrder: image.sortOrder,
    })),
    createdAt: room.createdAt.toISOString(),
    updatedAt: room.updatedAt.toISOString(),
  };
}

export type RoomResponse = ReturnType<typeof toRoomResponse>;
