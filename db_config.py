from pymysql.cursors import DictCursor

DB_CONFIG = {
    'host': 'localhost',   #   your host
    'user': 'root', #   your username
    'password': '', #   your password
    'db': 'indo-db',
    'charset': 'utf8mb4',
    'cursorclass': DictCursor
}
