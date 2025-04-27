export interface IQuery {
  limit: number;
  page: number;
  sortBy: string;
  order: 'asc' | 'desc';
}
