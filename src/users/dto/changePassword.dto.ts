import { MinLength } from 'class-validator';

export class ChangePasswordDto {
  @MinLength(6, { message: 'Old password incorrect' })
  oldPassword: string;

  @MinLength(6, { message: 'New password must be at least 6 characters' })
  newPassword: string;
}
