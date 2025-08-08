import { Injectable } from '@nestjs/common';
import { SignInDto } from './dto/signIn.dto';
import { UsersService } from 'src/users/users.service';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { PasswordReset } from './entities/passwordReset.entity';
import { Repository } from 'typeorm';
import { randomInt } from 'crypto';
import { addMinutes } from 'date-fns';
import { ResetPasswordDto } from './dto/resetPassword.dto';
import * as nodemailer from 'nodemailer';
import { RefreshToken } from './entities/refreshToken.entity';
import { User } from 'src/users/entities/user.entity';
import { send } from 'process';

@Injectable()
export class AuthService {
  constructor(
    private userService: UsersService,
    private jwtService: JwtService,
    @InjectRepository(PasswordReset)
    private passwordReset: Repository<PasswordReset>,
    @InjectRepository(RefreshToken)
    private refreshTokenRepo: Repository<RefreshToken>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  // AuthService
  generateTokens(payload: any) {
    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: process.env.JWT_EXPIRES_IN,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
    });

    return { accessToken, refreshToken };
  }

  async signIn(signInDto: SignInDto) {
    const user = await this.userService.validateUser(signInDto);

    if (!user) {
      return {
        message: 'Invalid email/username or password!',
        status: 401,
        access_token: null,
        refresh_token: null,
        user: null,
      };
    }

    const payload = { id: user.id, email: user.email };
    const { accessToken, refreshToken } = this.generateTokens(payload);

    await this.refreshTokenRepo.save({
      user_id: user.id,
      token: refreshToken,
    });

    return {
      message: 'Sign in successful!',
      status: 201,
      access_token: accessToken,
      refresh_token: refreshToken,
      user,
    };
  }

  async googleLogin(req: any) {
    if (!req.user) return 'No user from Google';

    let user = await this.userService.getUserByEmail(req.user.email);
    const randomPassword = Math.random().toString(36).slice(-6);
    if (!user) {
      user = await this.userService.registerUserGoogle({
        email: req.user.email,
        password: randomPassword,
        fullname: req.user.fullname,
      });
      await this.sendPasswordEmail(req.user.email, randomPassword);
    }

    const payload = { id: user.id, email: user.email, role: user.role };
    const { accessToken, refreshToken } = this.generateTokens(payload);

    return {
      message: 'Sign in with Google success, password sent to your email',
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  async refreshAccessToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      const savedToken = await this.refreshTokenRepo.findOne({
        where: {
          token: refreshToken,
          is_revoked: false,
        },
        relations: ['user'],
      });

      const user = await this.userRepo.findOne({
        where: {
          id: savedToken?.user_id,
        },
      });

      if (!savedToken || !savedToken.user_id) {
        return {
          status: 401,
          message: 'Invalid refresh token',
        };
      }

      const newPayload = {
        id: savedToken.user_id,
        email: user?.email,
      };

      const newAccessToken = this.jwtService.sign(newPayload, {
        secret: process.env.JWT_SECRET,
        expiresIn: process.env.JWT_EXPIRES_IN,
      });

      return {
        access_token: newAccessToken,
        message: 'Access token refreshed successfully',
      };
    } catch (err) {
      return {
        status: 401,
        message: 'Refresh token is invalid or has expired',
      };
    }
  }

  async forgotPassword(email: string) {
    const user = await this.userService.getUserByEmail(email);
    if (!user) {
      return { message: 'Email not found', status: 404 };
    }

    const otp = randomInt(100000, 999999).toString();
    const expiresAt = addMinutes(new Date(), 5);

    await this.passwordReset.delete({ email });

    await this.passwordReset.save({
      email,
      otp,
      expiresAt,
      createdAt: new Date(),
    });

    await this.sendOtpEmail(email, otp);
    return {
      message: 'OTP has been sent to your email',
      status: 200,
    };
  }

  private async sendOtpEmail(email: string, otp: string) {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: 'no-reply@yourapp.com',
      to: email,
      subject: 'Password Reset OTP Code',
      html: `<p>Your OTP code is: <b>${otp}</b> (expires in 5 minutes)</p>`,
    });
  }

  private async sendPasswordEmail(email: string, password: string) {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: 'no-reply@yourapp.com',
      to: email,
      subject: 'Your New Password is sent by Patronik',
      html: `<p>Your password is: <b>${password}</b> </p>`,
    });
  }

  async resetPassword(dto: ResetPasswordDto) {
    const { email, otp, newPassword } = dto;

    const record = await this.passwordReset.findOne({ where: { email, otp } });

    if (!record) {
      return { message: 'OTP is incorrect or does not exist', status: 400 };
    }

    const now = new Date();
    if (record.expiresAt < now) {
      return { message: 'OTP has expired', status: 400 };
    }

    const user = await this.userService.getUserByEmail(email);

    await this.userService.resetPassword(user.id, newPassword);

    // Xoá OTP sau khi dùng
    await this.passwordReset.delete({ id: record.id });

    return { message: 'Password reset successfully!' };
  }
}
