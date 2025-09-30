import { Router } from 'express';
import continueRouter from './continue';
import generateRouter from './generate';
import streamDemoRouter from './stream-demo';
import streamRouter from './stream';

const storyRouter = Router();

storyRouter.use('/continue', continueRouter);
storyRouter.use('/generate', generateRouter);
storyRouter.use('/stream-demo', streamDemoRouter);
storyRouter.use('/stream', streamRouter);

export default storyRouter;