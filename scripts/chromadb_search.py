#!/usr/bin/env python3
"""
ChromaDB 벡터 검색 브릿지 스크립트
- Electron 앱의 main process에서 child_process로 호출
- stdin으로 JSON 쿼리 받아서 stdout으로 JSON 결과 반환
- jhgan/ko-sbert-nli 모델로 쿼리 임베딩 생성
- 모델은 한 번만 로드하고 여러 쿼리를 처리 (persistent mode)
"""

import sys
import json
import os
import traceback

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

# Configuration
CHROMA_DB_PATH = os.environ.get('CHROMA_DB_PATH', 'E:/easydocs_vectordb/chroma_db')
MODEL_NAME = 'jhgan/ko-sbert-nli'
COLLECTION_NAME = 'easydocs'


def init():
    """모델과 ChromaDB 초기화"""
    global model, collection
    
    sys.stderr.write('Loading sentence-transformers model...\n')
    sys.stderr.flush()
    
    from sentence_transformers import SentenceTransformer
    model = SentenceTransformer(MODEL_NAME)
    
    sys.stderr.write('Connecting to ChromaDB...\n')
    sys.stderr.flush()
    
    import chromadb
    client = chromadb.PersistentClient(path=CHROMA_DB_PATH)
    collection = client.get_collection(COLLECTION_NAME)
    
    count = collection.count()
    sys.stderr.write(f'Ready. Collection: {COLLECTION_NAME}, Documents: {count:,}\n')
    sys.stderr.flush()
    
    return model, collection


def search(query, n_results=10, filters=None):
    """벡터 검색 수행"""
    # 쿼리 임베딩 생성
    embedding = model.encode(query, normalize_embeddings=True).tolist()
    
    # ChromaDB 검색 옵션
    query_params = {
        'query_embeddings': [embedding],
        'n_results': min(n_results, 50),
        'include': ['documents', 'metadatas', 'distances']
    }
    
    # 메타데이터 필터
    if filters:
        where = {}
        if filters.get('category'):
            where['category'] = filters['category']
        if filters.get('department'):
            where['department'] = filters['department']
        if filters.get('year') and filters['year'] > 0:
            where['year'] = filters['year']
        if filters.get('file_type'):
            where['file_type'] = filters['file_type']
        if where:
            query_params['where'] = where
    
    results = collection.query(**query_params)
    
    # 결과 포맷팅
    formatted = []
    for i in range(len(results['ids'][0])):
        meta = results['metadatas'][0][i] if results.get('metadatas') else {}
        doc = results['documents'][0][i] if results.get('documents') else ''
        distance = results['distances'][0][i] if results.get('distances') else 1.0
        
        formatted.append({
            'id': results['ids'][0][i],
            'document': doc[:2000],  # 최대 2000자
            'metadata': meta,
            'distance': round(distance, 4),
            'similarity': round(1 - distance, 4),
        })
    
    return formatted


def main():
    """메인 루프 - stdin에서 JSON 쿼리를 읽고 stdout으로 결과 반환"""
    try:
        m, c = init()
    except Exception as e:
        error_msg = json.dumps({
            'success': False,
            'error': f'초기화 실패: {str(e)}',
            'error_type': 'init_error'
        }, ensure_ascii=False)
        print(error_msg)
        sys.stdout.flush()
        sys.exit(1)
    
    # 준비 완료 시그널
    ready_msg = json.dumps({
        'success': True,
        'type': 'ready',
        'message': f'ChromaDB 검색 준비 완료 (문서 {c.count():,}건)'
    }, ensure_ascii=False)
    print(ready_msg)
    sys.stdout.flush()
    
    # 쿼리 처리 루프
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        
        if line == 'EXIT':
            break
        
        try:
            request = json.loads(line)
            query = request.get('query', '')
            n_results = request.get('n_results', 10)
            filters = request.get('filters', None)
            
            if not query:
                result = {
                    'success': False,
                    'error': '검색어가 비어있습니다.'
                }
            else:
                results = search(query, n_results, filters)
                result = {
                    'success': True,
                    'query': query,
                    'results': results,
                    'total': len(results)
                }
        except json.JSONDecodeError as e:
            result = {
                'success': False,
                'error': f'JSON 파싱 오류: {str(e)}'
            }
        except Exception as e:
            result = {
                'success': False,
                'error': f'검색 오류: {str(e)}',
                'traceback': traceback.format_exc()
            }
        
        print(json.dumps(result, ensure_ascii=False))
        sys.stdout.flush()


if __name__ == '__main__':
    # 단일 쿼리 모드 (커맨드라인 인자)
    if len(sys.argv) > 1:
        m, c = init()
        query = ' '.join(sys.argv[1:])
        results = search(query, n_results=5)
        print(json.dumps({
            'success': True,
            'query': query,
            'results': results,
            'total': len(results)
        }, ensure_ascii=False, indent=2))
    else:
        main()
