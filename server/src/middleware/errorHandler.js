import { ZodError } from "zod";
import { logger } from "../config/logger.js";
export function notFound(_req,res){res.status(404).json({error:{code:"NOT_FOUND",message:"Route not found"}})}
export function errorHandler(err,req,res,_next){ if(res.headersSent)return;
  if(err instanceof ZodError) return res.status(400).json({error:{code:"VALIDATION_ERROR",message:"Invalid request",details:err.flatten()}});
  if(err?.code==="LIMIT_FILE_SIZE") return res.status(413).json({error:{code:"FILE_TOO_LARGE",message:"Uploaded file exceeds the configured size limit"}});
  if(err?.code===11000) return res.status(409).json({error:{code:"CONFLICT",message:"A record with that value already exists"}});
  if(err?.name==="CastError") return res.status(400).json({error:{code:"INVALID_ID",message:"Invalid resource identifier"}});
  if(err?.name==="ValidationError") return res.status(400).json({error:{code:"DATABASE_VALIDATION_ERROR",message:"Database validation failed"}});
  const status=err.statusCode||500; if(status>=500) logger.error({err,requestId:req.id},"Request failed");
  res.status(status).json({error:{code:err.code||"INTERNAL_ERROR",message:status>=500&&process.env.NODE_ENV==="production"?"Internal server error":err.message||"Internal server error",details:err.details}});
}
