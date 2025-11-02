import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { SignInDto } from './dto/sign-in.dto';
import { SignUpDto } from './dto/sign-up.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from 'src/users/user.entity';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  async signUp(body: SignUpDto) {
    const { email, password, role } = body;

    this.logger.log('Attempting signup by user');
    const existingUser = await this.userRepository.findOne({ where: { email } });
    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    const user = this.userRepository.create({ email, password, role: role as UserRole });
    await this.userRepository.save(user);

    const token = await this.generateToken(user);
    const { password: _, ...userWithoutPassword } = user;

    return {
      status: 'Successful',
      token,
      data: {
        user: userWithoutPassword,
      },
    };
  }

  async signIn(body: SignInDto) {
    const { email, password } = body;

    this.logger.log(`Attempting login: ${email}`);
    if (!email || !password) {
      throw new UnauthorizedException('Email and password are required!');
    }

    const user = await this.userRepository.findOne({ where: { email } });
    const isMatched = await user?.comparePassword(password);

    if (!user || !isMatched) {
      throw new UnauthorizedException('Invalid email or password!');
    }

    const token = await this.generateToken(user);
    const { password: _, ...userWithoutPassword } = user;

    return {
      status: 'Successful',
      token,
      data: {
        user: userWithoutPassword,
      },
    };
  }

  async generateToken(user: User) {
    const secret = this.config.get<string>('JWT_SECRET');
    const expiresIn = this.config.get<string>('JWT_EXPIRES_IN') || '90d';

    // ✅ Fixed TS typing issue by explicitly casting `expiresIn` to any
    return await this.jwtService.signAsync(
      { id: user.id, role: user.role },
      {
        secret,
        expiresIn: expiresIn as any,
      },
    );
  }
}
