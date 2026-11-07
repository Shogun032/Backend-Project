import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const rooms = [
    {
      id: '00000000-0000-4000-8000-000000000101',
      name: 'Standard Single',
      description: 'Cozy room for one guest.',
      capacity: 1,
      pricePerNight: '1200.00',
      isActive: true,
      images: [
        {
          url: 'https://example.com/rooms/single-1.jpg',
          altText: 'Single bed',
          sortOrder: 0,
        },
        {
          url: 'https://example.com/rooms/single-2.jpg',
          altText: 'Bathroom',
          sortOrder: 1,
        },
      ],
    },
    {
      id: '00000000-0000-4000-8000-000000000102',
      name: 'Deluxe Double',
      description: 'Queen bed with city view.',
      capacity: 2,
      pricePerNight: '1800.00',
      isActive: true,
      images: [
        {
          url: 'https://example.com/rooms/double-1.jpg',
          altText: 'Queen bed',
          sortOrder: 0,
        },
        {
          url: 'https://example.com/rooms/double-2.jpg',
          altText: 'City view',
          sortOrder: 1,
        },
        {
          url: 'https://example.com/rooms/double-3.jpg',
          altText: 'Bathroom',
          sortOrder: 2,
        },
      ],
    },
    {
      id: '00000000-0000-4000-8000-000000000103',
      name: 'Family Suite',
      description: 'Two bedrooms, good for families.',
      capacity: 4,
      pricePerNight: '3200.00',
      isActive: true,
      images: [
        {
          url: 'https://example.com/rooms/family-1.jpg',
          altText: 'Living area',
          sortOrder: 0,
        },
        {
          url: 'https://example.com/rooms/family-2.jpg',
          altText: 'Bedroom',
          sortOrder: 1,
        },
      ],
    },
    {
      id: '00000000-0000-4000-8000-000000000104',
      name: 'Premium Suite',
      description: 'Top floor suite with balcony.',
      capacity: 3,
      pricePerNight: '4500.00',
      isActive: true,
      images: [
        {
          url: 'https://example.com/rooms/premium-1.jpg',
          altText: 'Balcony',
          sortOrder: 0,
        },
      ],
    },
    {
      id: '00000000-0000-4000-8000-000000000105',
      name: 'Old Wing Room (Closed)',
      description: 'Deactivated room for testing.',
      capacity: 2,
      pricePerNight: '900.00',
      isActive: false,
      images: [],
    },
  ];

  // Keep existing rooms and their booking history unchanged on every rerun.
  await prisma.$transaction(
    rooms.map(({ images, ...room }) =>
      prisma.room.upsert({
        where: { id: room.id },
        update: {},
        create: { ...room, images: { create: images } },
      }),
    ),
  );

  console.log(
    `Ensured ${rooms.length} sample rooms exist (existing data preserved)`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
