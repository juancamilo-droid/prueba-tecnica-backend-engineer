import { ICardIssuePayload } from './card-issue-payload.interface';
import { ICardEmission } from './card-emission.interface';

export interface ICardRetriesService {
  processWithRetries(payload: ICardIssuePayload): Promise<ICardEmission | null>;
}