import { ApiProperty } from '@nestjs/swagger';

export class ErrorDetailsDto {
  @ApiProperty({ type: String, example: 'DATABASE_UNAVAILABLE' })
  code!: string;

  @ApiProperty({ type: String })
  requestId!: string;
}

export class HttpErrorDto {
  @ApiProperty({ type: () => ErrorDetailsDto })
  error!: ErrorDetailsDto;
}
