import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateRoomDto } from './create-room.dto';
import { UpdateRoomDto } from './update-room.dto';
import 'reflect-metadata';

async function invalidFields(
  cls: new () => object,
  plain: object,
): Promise<string[]> {
  const errors = await validate(plainToInstance(cls, plain));
  return errors.map((error) => error.property);
}

const validRoom = {
  name: 'Deluxe Double',
  capacity: 2,
  pricePerNight: '1800.00',
};

describe('CreateRoomDto', () => {
  it('accepts a valid room', async () => {
    expect(await invalidFields(CreateRoomDto, validRoom)).toEqual([]);
  });

  it.each(['1', '0.50', '1500.00', '9999999.99'])(
    'accepts price %s',
    async (price) => {
      expect(
        await invalidFields(CreateRoomDto, { ...validRoom, pricePerNight: price }),
      ).toEqual([]);
    },
  );

  it.each(['0', '0.00', '-1', '1500.001', '10000000.00', 'abc', 1500])(
    'rejects price %p',
    async (price) => {
      expect(
        await invalidFields(CreateRoomDto, { ...validRoom, pricePerNight: price }),
      ).toContain('pricePerNight');
    },
  );

  it.each([0, -1, 1.5])('rejects capacity %p', async (capacity) => {
    expect(
      await invalidFields(CreateRoomDto, { ...validRoom, capacity }),
    ).toContain('capacity');
  });

  it('trims the name and rejects a blank name', async () => {
    const dto = plainToInstance(CreateRoomDto, {
      ...validRoom,
      name: '  Deluxe Double  ',
    });
    expect(dto.name).toBe('Deluxe Double');
    expect(
      await invalidFields(CreateRoomDto, { ...validRoom, name: '   ' }),
    ).toContain('name');
  });

  it('requires HTTPS image URLs', async () => {
    expect(
      await invalidFields(CreateRoomDto, {
        ...validRoom,
        images: [{ url: 'http://example.com/a.jpg' }],
      }),
    ).toContain('images');
    expect(
      await invalidFields(CreateRoomDto, {
        ...validRoom,
        images: [{ url: 'https://example.com/a.jpg' }],
      }),
    ).toEqual([]);
  });
});

describe('UpdateRoomDto', () => {
  it('accepts a partial update', async () => {
    expect(await invalidFields(UpdateRoomDto, { isActive: false })).toEqual([]);
  });

  it('rejects null instead of silently skipping the field', async () => {
    expect(await invalidFields(UpdateRoomDto, { name: null })).toContain('name');
    expect(await invalidFields(UpdateRoomDto, { capacity: null })).toContain(
      'capacity',
    );
  });
});
