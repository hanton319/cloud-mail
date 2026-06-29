import app from './hono/webs';
import { email } from './email/email';
import userService from './service/user-service';
import verifyRecordService from './service/verify-record-service';
import emailService from './service/email-service';
import kvObjService from './service/kv-obj-service';
import oauthService from "./service/oauth-service";
import analysisService from './service/analysis-service';
export default {
	 async fetch(req, env, ctx) {

		const url = new URL(req.url)

		if (url.pathname.startsWith('/api/')) {
			url.pathname = url.pathname.replace('/api', '')
			req = new Request(url.toString(), req)
			return app.fetch(req, env, ctx);
		}

		 //if (['/static/','/attachments/'].some(p => url.pathname.startsWith(p))) {
		 //  return await kvObjService.toObjResp( { env }, url.pathname.substring(1));
		 //}
if (['/static/', '/attachments/'].some(p => url.pathname.startsWith(p))) {
            try {
                // 1. 嘗試去撈取 R2 的檔案
                const resp = await kvObjService.toObjResp({ env }, url.pathname.substring(1));
                
                // 2. 如果成功撈到，且它是一個合法的 Response 物件，就正常回傳
                if (resp instanceof Response) {
                    return resp;
                }
                
                // 3. 防禦機制：如果撈出來的東西不是 Response（例如是 null 或原始物件），將其包裝成標準 Response
                if (resp && resp.body) {
                    return new Response(resp.body, {
                        status: 200,
                        headers: resp.headers || { "Content-Type": "application/octet-stream" }
                    });
                }
                
                // 4. 如果根本沒拿到東西（R2 找不到檔案），回傳標準的 404
                return new Response('File Not Found', { status: 404 });

            } catch (err) {
                // 5. 如果中間程式碼崩潰了，列印出錯誤，並回傳 500，但「絕對不會」再讓 Cloudflare 報 Promise 錯誤
                console.error("Error fetching from kvObjService:", err);
                return new Response(`Internal Server Error: ${err.message}`, { status: 500 });
            }
        }
		return env.assets.fetch(req);
	},
	email: email,
	async scheduled(c, env, ctx) {
		if (c.cron === '*/30 * * * *') {
			await analysisService.refreshEchartsCache({ env })
			return;
		}

		await verifyRecordService.clearRecord({ env })
		await userService.resetDaySendCount({ env })
		await emailService.completeReceiveAll({ env })
		await oauthService.clearNoBindOathUser({ env })
		await analysisService.refreshEchartsCache({ env })
	},
};
