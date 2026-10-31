import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.roomImage.deleteMany();
  await prisma.room.deleteMany();

  const rooms = [
    {
      name: 'Standard Single',
      description: 'Cozy room for one guest.',
      capacity: 1,
      pricePerNight: '1200.00',
      isActive: true,
      images: [
        { url: 'https://example.com/rooms/single-1.jpg', altText: 'Single bed', sortOrder: 0 },
        { url: 'https://example.com/rooms/single-2.jpg', altText: 'Bathroom', sortOrder: 1 },
      ],
    },
    {
      name: 'Deluxe Double',
      description: 'Queen bed with city view.',
      capacity: 2,
      pricePerNight: '1800.00',
      isActive: true,
      images: [
        { url: 'https://example.com/rooms/double-1.jpg', altText: 'Queen bed', sortOrder: 0 },
        { url: 'https://example.com/rooms/double-2.jpg', altText: 'City view', sortOrder: 1 },
        { url: 'https://example.com/rooms/double-3.jpg', altText: 'Bathroom', sortOrder: 2 },
      ],
    },
    {
      name: 'Family Suite',
      description: 'Two bedrooms, good for families.',
      capacity: 4,
      pricePerNight: '3200.00',
      isActive: true,
      images: [
        { url: 'https://example.com/rooms/family-1.jpg', altText: 'Living area', sortOrder: 0 },
        { url: 'https://example.com/rooms/family-2.jpg', altText: 'Bedroom', sortOrder: 1 },
      ],
    },
    {
      name: 'Premium Suite',
      description: 'Top floor suite with balcony.',
      capacity: 3,
      pricePerNight: '4500.00',
      isActive: true,
      images: [
        { url: 'https://example.com/rooms/premium-1.jpg', altText: 'Balcony', sortOrder: 0 },
      ],
    },
    {
      name: 'Old Wing Room (Closed)',
      description: 'Deactivated room for testing.',
      capacity: 2,
      pricePerNight: '900.00',
      isActive: false,
      images: [],
    },
  ];

  for (const r of rooms) {
    await prisma.room.create({
      data: {
        name: r.name,
        description: r.description,
        capacity: r.capacity,
        pricePerNight: r.pricePerNight,
        isActive: r.isActive,
        images: { create: r.images },
      },
    });
  }

  console.log(`Seeded ${rooms.length} rooms`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());