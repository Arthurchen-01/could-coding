#!/usr/bin/env python3
"""
AP Practice Website - 数据处理引擎
从 raw-json 提取题目，处理缺失答案，生成前端可用的 JSON
"""
import os
import json
import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple


class ExamDataProcessor:
    """考试数据处理器"""
    
    def __init__(self, raw_json_dir: str, pdf_dir: str = None):
        self.raw_json_dir = Path(raw_json_dir)
        self.pdf_dir = Path(pdf_dir) if pdf_dir else None
        
    def scan_available_exams(self) -> List[Dict]:
        """扫描可用的考试文件"""
        exams = []
        
        for json_file in self.raw_json_dir.glob("*.json"):
            try:
                with open(json_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                if 'data' not in data:
                    continue
                
                d = data['data']
                questions = d.get('questionList', [])
                
                # 分析题目
                mcq_count = sum(1 for q in questions if q.get('questionType') == 0)
                frq_count = sum(1 for q in questions if q.get('questionType') == 1)
                
                # 检查答案完整度
                has_answer = sum(1 for q in questions if q.get('correctQuestionAnswer'))
                
                exams.append({
                    'file': json_file.name,
                    'name': d.get('examName', json_file.stem),
                    'subject': d.get('subjectName', 'Unknown'),
                    'subject_id': d.get('subjectId', ''),
                    'total': len(questions),
                    'mcq': mcq_count,
                    'frq': frq_count,
                    'has_answer': has_answer,
                    'answer_coverage': round(has_answer / max(len(questions), 1) * 100, 1)
                })
            except Exception as e:
                exams.append({
                    'file': json_file.name,
                    'error': str(e)
                })
        
        return sorted(exams, key=lambda x: x.get('total', 0), reverse=True)
    
    def process_exam(self, filename: str) -> Optional[Dict]:
        """处理单个考试文件，转换为前端可用格式"""
        filepath = self.raw_json_dir / filename
        
        if not filepath.exists():
            return None
        
        with open(filepath, 'r', encoding='utf-8') as f:
            raw_data = json.load(f)
        
        if 'data' not in raw_data:
            return None
        
        d = raw_data['data']
        raw_questions = d.get('questionList', [])
        
        # 转换题目
        questions = []
        for i, rq in enumerate(raw_questions):
            q = self._convert_question(rq, i + 1)
            if q:
                questions.append(q)
        
        # 统计
        mcq_count = sum(1 for q in questions if q['type'] == 'mcq')
        frq_count = sum(1 for q in questions if q['type'] == 'frq')
        correct_count = sum(1 for q in questions if q.get('userCorrect') is True)
        answer_count = sum(1 for q in questions if q.get('userAnswer'))
        
        return {
            'examId': filename.replace('.json', ''),
            'subject': d.get('subjectName', 'Unknown'),
            'examName': d.get('examName', ''),
            'year': self._extract_year(d.get('examName', '')),
            'totalQuestions': len(questions),
            'mcqCount': mcq_count,
            'frqCount': frq_count,
            'correctCount': correct_count,
            'accuracy': round(correct_count / max(answer_count, 1) * 100, 1),
            'answerRate': round(answer_count / max(len(questions), 1) * 100, 1),
            'questions': questions,
            'units': self._extract_units(questions)
        }
    
    def _convert_question(self, rq: Dict, index: int) -> Optional[Dict]:
        """转换单个题目"""
        q_type = rq.get('questionType', 0)
        
        # 基础信息
        q = {
            'id': index,
            'sort': rq.get('sort', index),
            'title': rq.get('questionTitle', ''),
            'type': 'mcq' if q_type == 0 else 'frq',
            'questionType': q_type,
            'isCalculatorActive': rq.get('isCalculatorActive', False),
        }
        
        # 提取纯文本（从 HTML 中提取）
        html_content = rq.get('choiceQuestionContent', '')
        q['questionText'] = self._html_to_text(html_content) if html_content else rq.get('questionTitle', '')
        
        # MCQ 选项
        if q['type'] == 'mcq':
            option_list = rq.get('optionList', [])
            q['options'] = []
            for opt in option_list:
                q['options'].append({
                    'id': opt.get('optionSign', ''),
                    'text': self._html_to_text(opt.get('optionContent', '')),
                    'isExclude': opt.get('isExclude', 0) == 1
                })
        
        # FRQ 子问题
        if q['type'] == 'frq':
            subjective = rq.get('subjectiveQuestionList', [])
            q['parts'] = []
            for part in subjective:
                q['parts'].append({
                    'id': part.get('sort', ''),
                    'title': self._html_to_text(part.get('questionTitle', '')),
                    'text': self._html_to_text(part.get('choiceQuestionContent', '')),
                })
        
        # 答案
        correct_answer = rq.get('correctQuestionAnswer') or rq.get('correctSingleQuestionAnswer')
        if correct_answer:
            q['correctAnswer'] = str(correct_answer).strip()
        else:
            q['correctAnswer'] = None
        
        # 用户作答
        user_answer = rq.get('questionOption')
        if user_answer and isinstance(user_answer, list):
            # 用户选择了选项
            if len(user_answer) > 0:
                q['userAnswer'] = user_answer[0] if user_answer else None
            else:
                q['userAnswer'] = None
        else:
            q['userAnswer'] = user_answer
        
        # 正误判断
        is_right = rq.get('isRight')
        if is_right is not None:
            q['userCorrect'] = is_right == 1 or is_right is True
        else:
            q['userCorrect'] = None
        
        # 分析
        analysis = rq.get('analysis', '')
        q['analysis'] = self._html_to_text(analysis) if analysis else ''
        
        # 答案图片 URL
        q['answerUrl'] = rq.get('answerUrl', '')
        q['correctFileUrl'] = rq.get('correctFileUrl', '')
        
        # 所属 Unit（从题目标题中提取）
        q['unit'] = self._extract_unit_from_title(q['title'])
        
        return q
    
    def _html_to_text(self, html: str) -> str:
        """从 HTML 提取纯文本"""
        if not html:
            return ''
        
        # 移除 HTML 标签
        text = re.sub(r'<[^>]+>', ' ', html)
        
        # 清理特殊字符
        text = text.replace('\xa0', ' ').replace('\n', ' ').strip()
        
        # 压缩空格
        text = re.sub(r'\s+', ' ', text)
        
        return text
    
    def _extract_year(self, exam_name: str) -> str:
        """从考试名提取年份"""
        match = re.search(r'20\d{2}', exam_name)
        return match.group() if match else '2024'
    
    def _extract_unit_from_title(self, title: str) -> str:
        """从题目标题提取 Unit 信息"""
        if not title:
            return 'Unknown'
        
        # 简单映射
        title_lower = title.lower()
        
        unit_map = {
            'primitive types': 'Unit 1: Primitive Types',
            'using objects': 'Unit 2: Using Objects',
            'control flow': 'Unit 3: Control Flow',
            'iteration': 'Unit 4: Iteration',
            'writing classes': 'Unit 5: Writing Classes',
            'arrays': 'Unit 6: Arrays',
            'arraylist': 'Unit 7: ArrayList',
            '2d arrays': 'Unit 8: 2D Arrays',
            'inheritance': 'Unit 9: Inheritance',
            'recursion': 'Unit 10: Recursion',
        }
        
        for key, value in unit_map.items():
            if key in title_lower:
                return value
        
        return 'General'
    
    def _extract_units(self, questions: List[Dict]) -> List[Dict]:
        """提取 Unit 统计"""
        unit_stats = {}
        
        for q in questions:
            unit = q.get('unit', 'General')
            if unit not in unit_stats:
                unit_stats[unit] = {'total': 0, 'correct': 0, 'answered': 0}
            
            unit_stats[unit]['total'] += 1
            
            if q.get('userAnswer'):
                unit_stats[unit]['answered'] += 1
            
            if q.get('userCorrect') is True:
                unit_stats[unit]['correct'] += 1
        
        units = []
        for name, stats in unit_stats.items():
            accuracy = round(stats['correct'] / max(stats['answered'], 1) * 100, 1) if stats['answered'] > 0 else 0
            units.append({
                'name': name,
                'total': stats['total'],
                'answered': stats['answered'],
                'correct': stats['correct'],
                'accuracy': accuracy
            })
        
        return sorted(units, key=lambda x: x['accuracy'], reverse=True)
    
    def get_wrong_answers(self, exam_data: Dict) -> List[Dict]:
        """获取错题列表"""
        wrong = []
        
        for q in exam_data.get('questions', []):
            if q.get('userCorrect') is False or (
                q.get('userAnswer') and q.get('correctAnswer') and 
                str(q.get('userAnswer')).strip() != str(q.get('correctAnswer')).strip()
            ):
                wrong.append({
                    'id': q['id'],
                    'title': q.get('title', ''),
                    'questionText': q.get('questionText', '')[:100],
                    'userAnswer': q.get('userAnswer', '未作答'),
                    'correctAnswer': q.get('correctAnswer', '未知'),
                    'unit': q.get('unit', 'General'),
                    'analysis': q.get('analysis', ''),
                    'hasAnswerUrl': bool(q.get('answerUrl'))
                })
        
        return wrong
    
    def export_for_frontend(self, exam_data: Dict, output_path: str):
        """导出前端可用的 JSON"""
        output = {
            'examId': exam_data['examId'],
            'subject': exam_data['subject'],
            'examName': exam_data['examName'],
            'year': exam_data['year'],
            'totalQuestions': exam_data['totalQuestions'],
            'mcqCount': exam_data['mcqCount'],
            'frqCount': exam_data['frqCount'],
            'correctCount': exam_data['correctCount'],
            'accuracy': exam_data['accuracy'],
            'units': exam_data['units'],
            'questions': exam_data['questions']
        }
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(output, f, ensure_ascii=False, indent=2)
        
        return output_path


def scan_all_exams(raw_json_dir: str) -> List[Dict]:
    """快捷函数：扫描所有可用考试"""
    processor = ExamDataProcessor(raw_json_dir)
    return processor.scan_available_exams()


def process_exam_file(raw_json_dir: str, filename: str, output_dir: str = None) -> Dict:
    """快捷函数：处理单个考试"""
    processor = ExamDataProcessor(raw_json_dir)
    result = processor.process_exam(filename)
    
    if result and output_dir:
        os.makedirs(output_dir, exist_ok=True)
        out_path = os.path.join(output_dir, f"{result['examId']}.json")
        processor.export_for_frontend(result, out_path)
        result['_exported_to'] = out_path
    
    return result


if __name__ == '__main__':
    import sys
    
    raw_dir = '/root/openclaw-agent/workspace/AP-Learning-Web/question-storage/raw-json'
    
    if len(sys.argv) > 1:
        # 处理指定文件
        result = process_exam_file(raw_dir, sys.argv[1])
        if result:
            print(f"✅ Processed: {result['examName']}")
            print(f"   Questions: {result['totalQuestions']} (MCQ: {result['mcqCount']}, FRQ: {result['frqCount']})")
            print(f"   Accuracy: {result['accuracy']}%")
            print(f"   Answer Rate: {result['answerRate']}%")
        else:
            print("❌ Failed to process")
    else:
        # 扫描所有
        exams = scan_all_exams(raw_dir)
        print(f"Found {len(exams)} exams:\n")
        for e in exams[:10]:
            if 'error' in e:
                print(f"  ❌ {e['file']}: {e['error']}")
            else:
                print(f"  {'✅' if e['answer_coverage'] > 50 else '⚠️'} {e['name']}")
                print(f"     {e['total']} questions | MCQ: {e['mcq']} | FRQ: {e['frq']} | Answers: {e['answer_coverage']}%")
