import bankJson from './questions.json';
import { validateQuestionBank } from './questions.schema';
import type { QuestionBank } from '../../lib/taste/types';

// 模块加载期校验,失败立即抛出(开发期尽早失败)
validateQuestionBank(bankJson);

/** 编译后已校验的题库,运行时直接使用 */
export const questionBank: QuestionBank = bankJson;
