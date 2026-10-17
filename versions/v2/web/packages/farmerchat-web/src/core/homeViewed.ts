/**
 * #25 PATCH api/images/v2/viewed/ — which home cards are reported, and the request body.
 * App: HomeScreen.kt:2090-2094 (`trackCardVisibility`) marks a card viewed only when
 * `section.type == "image"` and it is not already viewed, and sends
 * `ImageViewedRequest(statement_id = it.toString(), user_id, status = "viewed")` (ApiServices.kt:247).
 * `statement` cards have a statement_id too, but it is not an image statement: DEMO answers 404 for them.
 * On DEMO the id is a UUID string (the app's SectionDto types it `Any?`), though SectionDto here says number.
 */
import type { ImageViewedRequest } from './types';

export function marksImageViewed(section: {
  type?: string | null;
  statement_id?: number | string | null;
  is_viewed?: boolean | null;
}): boolean {
  return section.type === 'image' && section.statement_id != null && section.is_viewed !== true;
}

export function imageViewedRequest(statementId: number | string, userId: string): ImageViewedRequest {
  return { statement_id: String(statementId), user_id: userId, status: 'viewed' };
}
