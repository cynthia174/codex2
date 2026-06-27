import { respData, respErr } from '@/shared/lib/resp';
import { getAllConfigs } from '@/shared/models/config';

const MAX_FILES = 14;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const SUPPORTED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const files = formData
      .getAll('files')
      .filter((value): value is File => value instanceof File)
      .slice(0, MAX_FILES);

    if (files.length === 0) {
      return respErr('No images provided');
    }

    const configs = await getAllConfigs();
    const apiKey = configs.evolink_api_key;
    if (!apiKey) {
      return respErr('Evolink API key is not configured');
    }

    const urls: string[] = [];

    for (const file of files) {
      if (!SUPPORTED_TYPES.has(file.type)) {
        return respErr('Only JPG, PNG, WebP, and GIF images are supported');
      }

      if (file.size > MAX_FILE_SIZE) {
        return respErr('Each image must be 10MB or smaller');
      }

      const bytes = Buffer.from(await file.arrayBuffer());
      const base64Data = `data:${file.type};base64,${bytes.toString('base64')}`;
      const response = await fetch(
        'https://files-api.evolink.ai/api/v1/files/upload/base64',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            base64_data: base64Data,
            file_name: file.name,
            upload_path: 'productpic-references',
          }),
          signal: AbortSignal.timeout(60_000),
        }
      );

      const result = await response.json().catch(() => null);
      const fileUrl = result?.data?.file_url;

      if (!response.ok || !result?.success || !fileUrl) {
        return respErr(
          result?.msg || result?.message || 'Reference image upload failed'
        );
      }

      urls.push(fileUrl);
    }

    return respData({ urls });
  } catch (error: any) {
    console.error('reference image upload failed:', error);
    return respErr(error?.message || 'Reference image upload failed');
  }
}
