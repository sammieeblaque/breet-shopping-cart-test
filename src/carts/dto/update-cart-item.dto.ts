import { IsNotEmpty, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateCartItemDto {
  @ApiProperty({ example: 3 })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  quantity: number;
}
