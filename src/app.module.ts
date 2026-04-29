import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
// import { CacheModule } from '@nestjs/cache-manager';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CategoriesModule } from './categories/categories.module';
import { SubcategoriesModule } from './subcategories/subcategories.module';
import { PlacesModule } from './places/places.module';
import { TablesModule } from './tables/tables.module';
import { PagePlansModule } from './page-plans/page-plans.module';
import { PageDefinitionsModule } from './page-definitions/page-definitions.module';
import { PageLinksModule } from './page-links/page-links.module';
import { FoodPlacesModule } from './food-places/food-places.module';
import { SplashModule } from './splash/splash.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { WebHomeModule } from './web-home/web-home.module';
import { VisitorsModule } from './visitors/visitors.module';

import { ContactMessagesModule } from './contact-messages/contact-messages.module';
import { StatsModule } from './stats/stats.module';
import { PageAuthoritiesModule } from './page-authorities/page-authorities.module';
import { TempPagesModule } from './temp-pages/temp-pages.module';
import { MediaModule } from './media/media.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    /*
    CacheModule.register({
      isGlobal: true,
      ttl: 60 * 1000, // 1 minute
      max: 100, // maximum number of items in cache
    }),
    */
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
      serveStaticOptions: {
        index: false,
      },
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    SubcategoriesModule,
    PlacesModule,
    TablesModule,
    PagePlansModule,
    PageDefinitionsModule,
    PageLinksModule,
    FoodPlacesModule,
    SplashModule,
    OnboardingModule,
    WebHomeModule,
    VisitorsModule,
    ContactMessagesModule,
    StatsModule,
    PageAuthoritiesModule,
    TempPagesModule,
    MediaModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule { }
