import crypto from "node:crypto";
import { csrfCookieName } from "../services/authService.js";
import { AppError } from "../utils/errors.js";
const safeMethods=new Set(["GET","HEAD","OPTIONS"]);
function equal(a,b){ if(!a||!b)return false; const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&crypto.timingSafeEqual(x,y); }
export function requireCsrf(req,_res,next){ if(safeMethods.has(req.method)) return next(); if(!equal(req.cookies?.[csrfCookieName], req.get("x-csrf-token"))) return next(new AppError("Invalid CSRF token",403,"CSRF_INVALID")); next(); }
