import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class AdminListRoomsDto extends PaginationDto {
  // query string มาเป็น "true"/"false" ต้องแปลงเองจากค่าดิบ
  // เพราะ Boolean("false") จะได้ true
  @IsOptional()
  @Transform(({ obj, key }: { obj: Record<string, unknown>; key: string }) => {
    const raw = obj[key];
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    return raw;
  })
  @IsBoolean()
  @ApiPropertyOptional({
    type: Boolean,
    description: 'Omit to include both active and inactive rooms',
  })
  isActive?: boolean;
}
