import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JobPriority } from '@prisma/client';

export class CreateJobDto {
  @ApiProperty({ example: 'DATA_PROCESSING' })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiPropertyOptional({ example: 'abc-123-idempotency-key' })
  @IsString()
  @IsOptional()
  idempotencyKey?: string;

  @ApiPropertyOptional({ enum: JobPriority, default: JobPriority.NORMAL })
  @IsEnum(JobPriority)
  @IsOptional()
  priority?: JobPriority = JobPriority.NORMAL;

  @ApiProperty({ description: 'The payload required to execute the job', required: false, default: {} })
  @IsOptional()
  @IsObject({ message: 'Payload must be a valid JSON object' })
  payload?: Record<string, any> = {};
}
