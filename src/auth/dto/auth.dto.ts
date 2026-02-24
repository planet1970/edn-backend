import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export enum UserRole {
  ADMIN = 'ADMIN',
  EXAM_OFFICER = 'EXAM_OFFICER',
  VIEWER = 'VIEWER',
}

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  email: string;

  @ApiProperty({ example: 'strongPassword123' })
  @IsString()
  @MinLength(6)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  password: string;

  @ApiProperty({ example: 'John Doe', required: false })
  @IsString()
  @IsOptional()
  name?: string;
  
  // Güvenlik gereği rolu client'tan direkt almayabiliriz ama şimdilik ekliyoruz
  @ApiProperty({ enum: UserRole, example: UserRole.VIEWER, required: false })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;
}

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  email: string;

  @ApiProperty({ example: 'strongPassword123' })
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  password: string;
}
