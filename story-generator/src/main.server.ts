import { BootstrapContext, bootstrapApplication } from '@angular/platform-browser';
import { AppRoot } from './app/app-root';
import { config } from './app/app.config.server';

const bootstrap = (context: BootstrapContext) =>
    bootstrapApplication(AppRoot, config, context);

export default bootstrap;
