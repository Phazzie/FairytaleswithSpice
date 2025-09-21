import axios, { AxiosResponse } from 'axios';
import { HttpClient } from './HttpClient';

export class AxiosHttpClient implements HttpClient {
  async post<T>(url: string, data: any, config?: any): Promise<T> {
    const response: AxiosResponse<T> = await axios.post(url, data, config);
    return response.data;
  }
}
