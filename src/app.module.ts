import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
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
  ],
  controllers: [],
  providers: [],
})
export class AppModule { }
