import { ApiProperty } from '@nestjs/swagger';

export class LivenessDto {
  @ApiProperty({ type: String, enum: ['ok'] })
  status!: 'ok';
}

export class ReadinessDto extends LivenessDto {
  @ApiProperty({ type: String, enum: ['available'] })
  database!: 'available';
}
