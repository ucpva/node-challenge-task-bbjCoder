import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Token Price Service (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Service is running');
  });

  it('/tokens (GET)', async () => {
    const response = await request(app.getHttpServer()).get('/tokens');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  it('/tokens (POST)', async () => {
    const newToken = {
      address: '0x1234567890abcdef',
      symbol: 'NEW',
      name: 'New Token',
      decimals: 18,
      chainId: '11111111-1111-1111-1111-111111111111',
    };

    const response = await request(app.getHttpServer())
      .post('/tokens')
      .send(newToken);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject(newToken);
  });
});