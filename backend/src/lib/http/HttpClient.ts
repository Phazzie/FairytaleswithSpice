export interface HttpClient {
  post<T>(url: string, data: any, config?: any): Promise<T>;
}
