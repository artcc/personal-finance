import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ type: String, format: 'email', maxLength: 254 })
  email!: string;
  @ApiProperty({ type: String, minLength: 12, maxLength: 128, writeOnly: true })
  password!: string;
}

export class RegisterDto extends LoginDto {
  @ApiProperty({ type: String, minLength: 1, maxLength: 80 })
  displayName!: string;
}

export class UserIdentityDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;
  @ApiProperty({ type: String, format: 'email' })
  email!: string;
  @ApiProperty({ type: String })
  displayName!: string;
}

export class CurrentSessionDto {
  @ApiProperty({ type: () => UserIdentityDto })
  user!: UserIdentityDto;
  @ApiProperty({ type: String, format: 'uuid' })
  sessionId!: string;
  @ApiProperty({ type: String })
  csrfToken!: string;
  @ApiProperty({ type: String, format: 'date-time' })
  expiresAt!: string;
  @ApiProperty({ type: String, format: 'date-time' })
  idleExpiresAt!: string;
}

export class ActiveSessionDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;
  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
  @ApiProperty({ type: String, format: 'date-time' })
  lastSeenAt!: string;
  @ApiProperty({ type: String, format: 'date-time' })
  expiresAt!: string;
  @ApiProperty({ type: Boolean })
  current!: boolean;
}
