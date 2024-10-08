import {
  forwardRef,
  Inject,
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import jwtConfig from 'src/auth/config/jwt.config';
import { GoogleTokenDto } from '../dtos/google-token.dto';
import { UsersService } from 'src/users/providers/users.service';
import { GenerateTokensProvider } from 'src/auth/providers/generate-tokens.provider';

@Injectable()
export class GoogleAuthenticationService implements OnModuleInit {
  private oauthClien: OAuth2Client;

  constructor(
    /**
     * Injecting jwtConfiguration
     */
    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,

    /**
     * Injecting UserService
     */
    @Inject(forwardRef(() => UsersService))
    private readonly userService: UsersService,
    /**
     * Injecting GenerateTokenProvider
     */
    private readonly generateTokenProvider: GenerateTokensProvider,
  ) {}

  onModuleInit() {
    const clientId = this.jwtConfiguration.googleClientId;
    const clientSercret = this.jwtConfiguration.googleClientSecret;
    this.oauthClien = new OAuth2Client(clientId, clientSercret);
  }

  public async authenticate(googleTokenDto: GoogleTokenDto) {
    try {
      // Verify the google token
      const loginTicket = await this.oauthClien.verifyIdToken({
        idToken: googleTokenDto.token,
      });

      // Extract payload
      const {
        email,
        sub: googleId,
        given_name: firstName,
        family_name: lastName,
      } = loginTicket.getPayload();

      // Find the user by the google ID
      const user = await this.userService.findOneByGoogleId(googleId);

      // If exist - generate token
      if (user) {
        return this.generateTokenProvider.generateTokens(user);
      }

      // If not - create a new user and then generate token
      const newUser = await this.userService.createGoogleUser({
        email,
        googleId,
        firstName,
        lastName,
      });

      return this.generateTokenProvider.generateTokens(newUser);
    } catch (error) {
      throw new UnauthorizedException(error);
    }
  }
}
