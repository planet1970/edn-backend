import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RegisterDto, LoginDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) { }

  async register(registerDto: RegisterDto) {
    const existingUser = await this.usersService.findOne(registerDto.email);
    if (existingUser) {
      throw new ConflictException('Bu e-posta adresi zaten kayıtlı.');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    // Enum mapping or direct assignment depending on Prisma generation
    // using 'any' cast for Role enum temporarily until Prisma client is regenerated
    const user = await this.usersService.create({
      ...registerDto,
      password: hashedPassword,
      role: registerDto.role as any || 'VIEWER',
    });

    const { password, ...result } = user;
    return result;
  }

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findOne(loginDto.email);
    if (!user) {
      throw new UnauthorizedException('E-posta veya şifre hatalı.');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('E-posta veya şifre hatalı.');
    }

    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      }
    };
  }

  async googleLogin(payload: { email: string; name: string; googleId: string }) {
    let user = await this.usersService.findOne(payload.email);

    if (user) {
      if (!user.googleId) {
        user = await this.usersService.update(user.id, { googleId: payload.googleId });
      }
    } else {
      user = await this.usersService.create({
        email: payload.email,
        name: payload.name,
        password: null,
        googleId: payload.googleId,
        role: 'VIEWER' as any,
      });
    }

    const tokenPayload = { sub: user.id, email: user.email, role: user.role };
    return {
      access_token: this.jwtService.sign(tokenPayload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      }
    };
  }
}
