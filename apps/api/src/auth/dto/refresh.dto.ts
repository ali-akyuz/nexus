import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshDto {
  @ApiProperty({ example: 'refresh-token-string-here' })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
