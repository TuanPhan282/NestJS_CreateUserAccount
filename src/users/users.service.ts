import { Injectable } from '@nestjs/common';
import { CreateUserDto, CreateUserGoogleDto } from './dto/createUser.dto';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { SignInDto } from 'src/auth/dto/signIn.dto';
import { instanceToPlain } from 'class-transformer';
import { UpdateUserDto } from './dto/updateUser.dto';
import { ChangePasswordDto } from './dto/changePassword.dto';
import { RefreshToken } from 'src/auth/entities/refreshToken.entity';
import { supabase } from './upload/supabase.client';
import { v4 as uuidv4 } from 'uuid';
import { extname } from 'path';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(RefreshToken)
    private refreshTokenRepo: Repository<RefreshToken>,
  ) {}

  async registerUser(createUserDto: CreateUserDto) {
    const emailExists = await this.userRepo.findOneBy({
      email: createUserDto.email,
    });
    if (emailExists) {
      return { message: 'Email already exists', status: 409 };
    }

    const hashed = await bcrypt.hash(createUserDto.password, 10);
    const user = createUserDto;
    user.password = hashed;

    const saved = await this.userRepo.save(user);
    return {
      message: 'User registered successfully',
      status: 201,
      user: saved,
    };
  }

  async registerUserGoogle(createUserGoogleDto: CreateUserGoogleDto) {
    const randomPassword = Math.random().toString(36).slice(-6);
    const hashedPassword = await bcrypt.hash(randomPassword, 10);

    const user = this.userRepo.create({
      ...createUserGoogleDto,
      fullname: createUserGoogleDto.fullname,
      password: hashedPassword,
    });

    const saved = await this.userRepo.save(user);
    return {
      message: 'User registered with Google successfully',
      status: 201,
      user: saved,
    };
  }

  async getMyProfile(id: number) {
    const user = await this.userRepo.findOne({
      where: { id: id },
    });

    if (!user) {
      return { message: 'User not found', status: 404 };
    }

    return instanceToPlain(user);
  }

  async updateProfile(id: number, updateUserDto: UpdateUserDto) {
    const user = await this.userRepo.findOneBy({ id });
    if (updateUserDto.email) {
      const email = await this.userRepo.findOneBy({
        email: updateUserDto.email,
      });

      if (email) {
        return { message: 'Email already exists', status: 409 };
      }
    }

    if (!user) {
      throw new Error('User not found');
    }
    await this.userRepo.update(id, updateUserDto);

    return {
      message: 'Profile updated successfully',
      status: 200,
      data: updateUserDto,
    };
  }

  async uploadAvatarToSupabase(id: number, file: Express.Multer.File) {
    const fileExt = extname(file.originalname);
    const fileName = `${uuidv4()}${fileExt}`;

    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/jpg',
      'image/webp',
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      return {
        message: 'Only image files are allowed (jpg, jpeg, png, webp)',
        status: 400,
      };
    }

    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (error) {
      throw new Error(error.message);
    }

    const publicUrl = supabase.storage.from('avatars').getPublicUrl(fileName)
      .data.publicUrl;

    await this.userRepo.update(id, { avatar: publicUrl });

    return { url: publicUrl };
  }

  async validateUser(signInDto: SignInDto) {
    const { email, password } = signInDto;

    const user = await this.userRepo.findOne({
      where: [{ email: email }],
    });

    if (user && (await bcrypt.compare(password, user.password))) {
      return user;
    }

    return null;
  }

  async resetPassword(id: number, newPassword: string) {
    const user = this.userRepo.findOneBy({ id });

    if (!user) {
      return { message: 'User not found', status: 404 };
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.userRepo.update(id, { password: hashedPassword });
    return { message: 'Password updated successfully', status: 200 };
  }

  async changePassword(id: number, changePasswordDto: ChangePasswordDto) {
    const { oldPassword, newPassword } = changePasswordDto;
    const user = await this.userRepo.findOneBy({ id });
    if (!user) {
      return { message: 'User not found', status: 404 };
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return { message: 'Old password is incorrect', status: 400 };
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.userRepo.update(id, { password: hashedPassword });
    return { message: 'Password changed successfully', status: 200 };
  }

  async getUserByEmail(email: string): Promise<any | null> {
    const user = await this.userRepo.findOne({ where: { email } });

    return instanceToPlain(user);
  }

  async deleteAccount(id: number) {
    const user = await this.userRepo.findOneBy({ id });
    if (!user) {
      return { message: 'User not found', status: 404 };
    }
    await this.refreshTokenRepo.delete({ user_id: id });
    await this.userRepo.remove(user);
    return { message: 'Account deleted successfully', status: 200 };
  }
}
