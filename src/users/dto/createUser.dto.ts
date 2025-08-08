import { Optional } from '@nestjs/common';
import {
  IsEmail,
  IsEmpty,
  IsNotEmpty,
  IsOptional,
  MinLength,
} from 'class-validator';
import { de } from 'date-fns/locale';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsNotEmpty({ message: 'Fullname is required' })
  fullname: string;

  @IsOptional()
  displayName?: string;

  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password: string;

  @IsOptional()
  avatar?: string;
}

export class CreateUserGoogleDto {
  @IsEmail()
  email: string;

  fullname: string;

  password?: string;
}
