import { decodeQuotedPrintable } from '../utils/quotedPrintable';
import { BaseJobEmailParser } from './BaseJobEmailParser';
import { decodeGmailBodyData } from '../utils/gmail';
import { RawJobPosting } from '../types';
import { decodeHtmlEntities, stripHtml } from '../utils/html';

type GmailPayload = {
  mimeType?: string | null;
  body?: { data?: string | null; attachmentId?: string | null } | null;
  parts?: GmailPayload[] | null;
};

export abstract class HtmlJobEmailParser extends BaseJobEmailParser {
  protected abstract parseJobsFromHtml(html: string): RawJobPosting[];

  protected parseJobsFromText(text: string): RawJobPosting[] {
    void text;
    return [];
  }

  protected decodeHtmlText(value: string): string {
    return decodeHtmlEntities(value);
  }

  protected cleanHtmlText(value: string): string {
    return decodeHtmlEntities(
      stripHtml(
        value
          .replace(/<br\s*\/?>/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      )
    )
      .replace(/\s+/g, ' ')
      .replace(/[=]+\s*$/g, '')
      .trim();
  }

  protected looksLikeLocation(value: string): boolean {
    if (!value) return false;
    if (/\bremote\b/i.test(value)) return true;
    if (/[A-Za-z].*,\s*[A-Za-z]{2}\b/.test(value)) return true;
    if (/[A-Za-z].*,\s*[A-Za-z]{3,}\b/.test(value)) return true;
    return false;
  }

  protected looksLikeSalary(value: string): boolean {
    return /\$\s*\d/.test(value) || /\babout\s*\$\s*\d/i.test(value);
  }

  protected escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  protected decodeMaybeQuotedPrintable(value: string): string {
    if (!value) return '';
    if (value.includes('=3D') || /=\r?\n/.test(value)) {
      return decodeQuotedPrintable(value);
    }
    return value;
  }

  protected looksLikeHtml(value: string): boolean {
    return /<html[\s>]|<!DOCTYPE html|<table[\s>]/i.test(value);
  }

  protected parseJobsFromBody(body: string): RawJobPosting[] {
    if (!body) return [];

    const normalized = body.replace(/\r\n/g, '\n');

    if (this.looksLikeHtml(normalized)) {
      const jobsFromHtml = this.parseJobsFromHtml(normalized);
      if (jobsFromHtml.length > 0) return jobsFromHtml;
    }

    return this.parseJobsFromText(normalized);
  }

  public parseJobsFromRawEml(rawEml: string): RawJobPosting[] {
    const htmlBody = this.extractPartBodyFromRawEml(rawEml, 'text/html');
    if (htmlBody) return this.parseJobsFromBody(this.decodeMaybeQuotedPrintable(htmlBody));

    const textBody = this.extractPartBodyFromRawEml(rawEml, 'text/plain');
    return this.parseJobsFromBody(this.decodeMaybeQuotedPrintable(textBody));
  }

  protected async extractPreferredBody(input: {
    payload: GmailPayload | undefined;
    gmail?: any;
    messageId?: string;
    allowAttachment?: boolean;
  }): Promise<string> {
    const htmlBody = await this.extractBodyByMime({
      ...input,
      wantedMimeType: 'text/html'
    });
    if (htmlBody) return htmlBody;

    const textBody = await this.extractBodyByMime({
      ...input,
      wantedMimeType: 'text/plain'
    });
    if (textBody) return textBody;

    return '';
  }

  protected async extractBodyByMime(input: {
    payload: GmailPayload | undefined;
    wantedMimeType: 'text/html' | 'text/plain';
    gmail?: any;
    messageId?: string;
    allowAttachment?: boolean;
  }): Promise<string> {
    const { payload, wantedMimeType, gmail, messageId, allowAttachment } = input;
    if (!payload) return '';

    const mimeType = payload.mimeType ?? '';
    if (mimeType === wantedMimeType) {
      if (payload.body?.data) {
        const decoded = decodeGmailBodyData(payload.body.data);
        return this.decodeMaybeQuotedPrintable(decoded);
      }

      if (allowAttachment && payload.body?.attachmentId && gmail && messageId) {
        const attachment = await gmail.users.messages.attachments.get({
          userId: 'me',
          messageId,
          id: payload.body.attachmentId
        });

        const attachmentData = attachment?.data?.data;
        if (attachmentData) {
          const decoded = decodeGmailBodyData(attachmentData);
          return this.decodeMaybeQuotedPrintable(decoded);
        }
      }
    }

    for (const part of payload.parts || []) {
      const result = await this.extractBodyByMime({
        ...input,
        payload: part
      });
      if (result) return result;
    }

    return '';
  }
}
