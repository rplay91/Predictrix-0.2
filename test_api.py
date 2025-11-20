import pymysql

from db_config import DB_CONFIG


def check_pretest_status(sid: str) -> bool:
    """Return True when the student still has to complete the pre-test essay."""
    connection = None
    try:
        connection = pymysql.connect(**DB_CONFIG)
        with connection.cursor() as cursor:
            sql = """
                SELECT COUNT(*) AS count
                FROM essay_state
                WHERE sid = %s
                  AND source = 'Pre-test'
                  AND state = 'Completed'
            """
            cursor.execute(sql, (sid,))
            result = cursor.fetchone()

            # No completed pre-test means the student still needs to submit it.
            return result["count"] == 0

    except Exception as e:
        print(f"Error checking pre-test status: {str(e)}")
        return False

    finally:
        if connection:
            connection.close()


def initialize_pretest_essay(sid: str) -> dict:
    """Create a new pre-test essay entry and link it to the student."""
    connection = None
    try:
        connection = pymysql.connect(**DB_CONFIG)
        with connection.cursor() as cursor:
            # Insert an empty essay record. Content will be filled later.
            sql1 = """
                INSERT INTO essay_info (topic, content, start_time)
                VALUES ('How To Make Kimchi', '', NOW())
            """
            cursor.execute(sql1)

            # Capture the generated essay id.
            eid = cursor.lastrowid

            # Associate the essay with the student in essay_state.
            sql2 = """
                INSERT INTO essay_state (sid, eid, source, state)
                VALUES (%s, %s, 'Pre-test', 'Editing')
            """
            cursor.execute(sql2, (sid, eid))

            connection.commit()
            return {
                "success": True,
                "eid": eid,
                "message": "Essay initialized successfully",
            }

    except Exception as e:
        if connection:
            connection.rollback()
        return {
            "success": False,
            "message": f"Failed to initialize essay: {str(e)}",
        }

    finally:
        if connection:
            connection.close()


def update_pretest_essay_content(eid: str, content: str) -> dict:
    """Save the student's pre-test essay content and mark the essay completed."""
    connection = None
    try:
        connection = pymysql.connect(**DB_CONFIG)
        with connection.cursor() as cursor:
            # Update the essay content.
            sql1 = """
                UPDATE essay_info 
                SET content = %s
                WHERE eid = %s
            """
            cursor.execute(sql1, (content, eid))

            # Update the essay status.
            sql2 = """
                UPDATE essay_state
                SET state = 'Completed'
                WHERE eid = %s
            """
            cursor.execute(sql2, (eid,))

            connection.commit()
            return {
                "success": True,
                "message": "Essay updated successfully",
            }

    except Exception as e:
        if connection:
            connection.rollback()
        return {
            "success": False,
            "message": f"Failed to update essay: {str(e)}",
        }

    finally:
        if connection:
            connection.close()


def check_posttest_status(sid: str) -> bool:
    """Return True when the student still has to complete the post-test essay."""
    connection = None
    try:
        connection = pymysql.connect(**DB_CONFIG)
        with connection.cursor() as cursor:
            sql = """
                SELECT COUNT(*) AS count
                FROM essay_state
                WHERE sid = %s
                  AND source = 'Post-test'
                  AND state = 'Completed'
            """
            cursor.execute(sql, (sid,))
            result = cursor.fetchone()

            return result["count"] == 0

    except Exception as e:
        print(f"Error checking post-test status: {str(e)}")
        return False

    finally:
        if connection:
            connection.close()


def initialize_posttest_essay(sid: str) -> dict:
    """Create a new post-test essay entry and link it to the student."""
    connection = None
    try:
        connection = pymysql.connect(**DB_CONFIG)
        with connection.cursor() as cursor:
            sql1 = """
                INSERT INTO essay_info (topic, content, start_time)
                VALUES ('Introducing Lebaran in Indonesia', '', NOW())
            """
            cursor.execute(sql1)

            eid = cursor.lastrowid

            sql2 = """
                INSERT INTO essay_state (sid, eid, source, state)
                VALUES (%s, %s, 'Post-test', 'Editing')
            """
            cursor.execute(sql2, (sid, eid))

            connection.commit()
            return {
                "success": True,
                "eid": eid,
                "message": "Essay initialized successfully",
            }

    except Exception as e:
        if connection:
            connection.rollback()
        return {
            "success": False,
            "message": f"Failed to initialize essay: {str(e)}",
        }

    finally:
        if connection:
            connection.close()
